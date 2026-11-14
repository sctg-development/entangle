// wormhole-page: browser client and WebSocket transit bridge for magic-wormhole.
//
// Copyright (c) 2026 Luca Martinetti (MIT License)
// Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

use axum::{
    Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{StatusCode, header::{HeaderName, HeaderValue}},
    response::{Html, IntoResponse},
};
use clap::Parser;
use futures_util::{SinkExt, StreamExt};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::net::TcpStream;
use tower_http::services::ServeDir;

/// Standard magic-wormhole file-transfer AppID (interoperates with the stock CLIs).
const OFFICIAL_APP_ID: &str = "lothar.com/wormhole/text-or-file-xfer";
const OFFICIAL_MAILBOX: &str = "wss://relay.magic-wormhole.io:443/v1";
const OFFICIAL_TRANSIT: &str = "transit.magic-wormhole.io:4001";

#[derive(Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
enum Profile {
    /// Your own mailbox + transit relay (same origin as this page).
    SelfHosted,
    /// The public servers of the magic-wormhole project (works with any stock client).
    Official,
}

/// Browser client for entangle / magic-wormhole transfers.
#[derive(Parser)]
struct Args {
    /// Port to listen on
    #[arg(long, default_value = "8080", env = "PORT")]
    port: u16,

    /// Directory containing static files (index.html, wasm/, etc.)
    #[arg(long, default_value = "static", env = "STATIC_DIR")]
    static_dir: PathBuf,

    /// Server profile. `self-hosted` (default) points the page at your own
    /// mailbox (`/v1` on the same host) and transit relay; `official` uses the
    /// public magic-wormhole servers and the standard AppID.
    #[arg(long, value_enum, default_value = "self-hosted", env = "WORMHOLE_PROFILE")]
    profile: Profile,

    /// Wormhole AppID. Peers only meet when their AppID is identical.
    /// Default: github.com/sctg-development/entangle (self-hosted) or the
    /// standard magic-wormhole AppID (official).
    #[arg(long, env = "APP_ID")]
    app_id: Option<String>,

    /// Mailbox (rendezvous) WebSocket URL given to browsers. Empty/unset means
    /// `/v1` on the page's own host (self-hosted) or the public server (official).
    #[arg(long, env = "MAILBOX_URL")]
    mailbox_url: Option<String>,

    /// Upstream transit relay (TCP host:port) the /transit bridge connects to.
    /// Default: 127.0.0.1:4001 (self-hosted) or the public relay (official).
    #[arg(long, env = "TRANSIT_RELAY")]
    transit_relay: Option<String>,

    /// TCP URL of the transit relay advertised to CLI peers, e.g.
    /// tcp://relay.example.org:4001. Default (self-hosted): tcp://<page host>:4001.
    #[arg(long, env = "TRANSIT_HINT")]
    transit_hint: Option<String>,

    /// Where the "Get entangle" link points.
    #[arg(
        long,
        default_value = "https://github.com/sctg-development/entangle/releases/latest",
        env = "ENTANGLE_URL"
    )]
    entangle_url: String,

    /// Value for the CSP `connect-src` directive (single-quoted sources, space-separated).
    /// Default: 'self' plus the origin of an absolute mailbox URL.
    #[arg(long, env = "CSP_CONNECT_SRC")]
    csp_connect_src: Option<String>,
}

/// Runtime configuration handed to the browser at GET /config.json.
#[derive(Clone)]
struct ClientConfig {
    app_id: String,
    mailbox_url: String, // empty = same origin /v1
    transit_hint: Option<String>, // None = derive from the Host header
    entangle_url: String,
}

fn ws_origin(url: &str) -> Option<String> {
    let rest = url.strip_prefix("wss://").or_else(|| url.strip_prefix("ws://"))?;
    let scheme = if url.starts_with("wss://") { "wss" } else { "ws" };
    let host = rest.split('/').next()?;
    (!host.is_empty()).then(|| format!("{scheme}://{host}"))
}

/// Build the full Content-Security-Policy from a connect-src value.
fn build_csp(connect_src: &str) -> Option<HeaderValue> {
    let csp = format!(
        "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src {connect_src}; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    HeaderValue::from_str(&csp).ok()
}

#[derive(Clone)]
struct AppState {
    index_html: Arc<String>,
    service_worker: Arc<String>,
    transit_relay: Arc<String>,
    csp: HeaderValue,
    client_config: Arc<ClientConfig>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let args = Args::parse();

    // Read index.html at startup for SPA fallback
    let index_path = args.static_dir.join("index.html");
    let index_html = std::fs::read_to_string(&index_path)
        .unwrap_or_else(|e| panic!("Failed to read {}: {e}", index_path.display()));

    // Read sw.js at startup for root-scoped service worker
    let sw_path = args.static_dir.join("sw.js");
    let service_worker = std::fs::read_to_string(&sw_path)
        .unwrap_or_else(|e| panic!("Failed to read {}: {e}", sw_path.display()));

    let official = args.profile == Profile::Official;
    let app_id = args
        .app_id
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| {
            if official { OFFICIAL_APP_ID } else { "github.com/sctg-development/entangle" }.to_string()
        });
    let mailbox_url = args
        .mailbox_url
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| if official { OFFICIAL_MAILBOX.to_string() } else { String::new() });
    let transit_relay = args
        .transit_relay
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| if official { OFFICIAL_TRANSIT } else { "127.0.0.1:4001" }.to_string());
    let transit_hint = args.transit_hint.filter(|v| !v.is_empty()).or_else(|| {
        official.then(|| format!("tcp://{OFFICIAL_TRANSIT}"))
    });

    let connect_src = args.csp_connect_src.unwrap_or_else(|| match ws_origin(&mailbox_url) {
        Some(origin) => format!("'self' {origin}"),
        None => "'self'".to_string(),
    });
    let csp = build_csp(&connect_src).unwrap_or_else(|| {
        panic!(
            "Invalid CSP_CONNECT_SRC {connect_src:?}: must be a valid header value \
             (no leading/trailing whitespace or control characters)"
        )
    });

    let state = AppState {
        index_html: Arc::new(index_html),
        service_worker: Arc::new(service_worker),
        transit_relay: Arc::new(transit_relay.clone()),
        csp,
        client_config: Arc::new(ClientConfig {
            app_id,
            mailbox_url,
            transit_hint,
            entangle_url: args.entangle_url,
        }),
    };

    // Static file service
    let static_service = ServeDir::new(&args.static_dir);

    let app = Router::new()
        .route("/health", axum::routing::get(health))
        .route("/sw.js", axum::routing::get(serve_sw))
        .route("/transit", axum::routing::get(transit_ws))
        .route("/config.json", axum::routing::get(client_config))
        // SPA fallback: /receive/<code> serves index.html
        .route("/receive/{code}", axum::routing::get(spa_fallback))
        // Static files under /static/
        .nest_service("/static", static_service)
        // Root serves index.html
        .fallback(axum::routing::get(root_or_404))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            security_headers,
        ))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], args.port));
    tracing::info!("listening on {addr}");
    tracing::info!("transit bridge → {transit_relay}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Middleware that adds security headers to every response.
async fn security_headers(
    State(state): State<AppState>,
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> impl IntoResponse {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        HeaderName::from_static("content-security-policy"),
        state.csp.clone(),
    );
    headers.insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );
    headers.insert(
        HeaderName::from_static("strict-transport-security"),
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers.insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    response
}

/// GET /health
async fn health() -> &'static str {
    "ok"
}

/// GET /sw.js — serve the service worker from root scope with no-cache
async fn serve_sw(State(state): State<AppState>) -> impl IntoResponse {
    (
        [
            (
                HeaderName::from_static("content-type"),
                HeaderValue::from_static("application/javascript"),
            ),
            (
                HeaderName::from_static("cache-control"),
                HeaderValue::from_static("no-cache"),
            ),
        ],
        state.service_worker.as_str().to_string(),
    )
}

/// Strip the port from a Host header value (IPv6 literals keep their brackets).
fn host_without_port(host: &str) -> String {
    if let Some(end) = host.find(']') {
        return host[..=end].to_string();
    }
    match host.rsplit_once(':') {
        Some((h, p)) if !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()) => h.to_string(),
        _ => host.to_string(),
    }
}

/// GET /config.json: runtime configuration for the browser client.
///
/// Lets one build of the WASM client serve any deployment: self-hosted or the
/// official public servers, selected by the server's profile.
async fn client_config(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let c = &state.client_config;
    let hint = c.transit_hint.clone().unwrap_or_else(|| {
        // Default: same host as the page, standard transit port.
        let host = headers
            .get(axum::http::header::HOST)
            .and_then(|h| h.to_str().ok())
            .map(host_without_port)
            .unwrap_or_default();
        if host.is_empty() { String::new() } else { format!("tcp://{host}:4001") }
    });
    let body = serde_json::json!({
        "appId": c.app_id,
        "mailboxUrl": c.mailbox_url,
        "transitHint": hint,
        "entangleUrl": c.entangle_url,
    });
    (
        [
            (
                HeaderName::from_static("content-type"),
                HeaderValue::from_static("application/json"),
            ),
            (
                HeaderName::from_static("cache-control"),
                HeaderValue::from_static("no-store"),
            ),
        ],
        body.to_string(),
    )
}

/// GET / (and fallback for unknown routes)
async fn root_or_404(
    State(state): State<AppState>,
    req: axum::http::Request<axum::body::Body>,
) -> impl IntoResponse {
    if req.uri().path() == "/" {
        Html(state.index_html.as_str().to_string()).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

/// GET /receive/<code> — serve index.html (SPA, JS handles the code)
async fn spa_fallback(State(state): State<AppState>) -> Html<String> {
    Html(state.index_html.as_str().to_string())
}

/// GET /transit — WebSocket-to-TCP bridge
///
/// Bridges a browser WebSocket connection to the upstream transit relay
/// via TCP. Both the browser and CLI peer meet at the same relay.
///
///   Browser ──WS──▶ this server ──TCP──▶ transit relay (TRANSIT_RELAY)
///   CLI ──────────────────TCP──────────▶ the same transit relay
async fn transit_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_transit(socket, state.transit_relay))
}

async fn handle_transit(ws: WebSocket, relay_addr: Arc<String>) {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    tracing::info!("transit bridge: browser connected");
    let start = std::time::Instant::now();

    // Connect to upstream TCP relay with a timeout
    let tcp = match tokio::time::timeout(
        Duration::from_secs(10),
        TcpStream::connect(relay_addr.as_str()),
    )
    .await
    {
        Ok(Ok(stream)) => {
            // Set TCP keepalive to detect dead connections
            let sock_ref = socket2::SockRef::from(&stream);
            let keepalive = socket2::TcpKeepalive::new()
                .with_time(Duration::from_secs(30))
                .with_interval(Duration::from_secs(10));
            let _ = sock_ref.set_tcp_keepalive(&keepalive);
            stream
        }
        Ok(Err(e)) => {
            tracing::warn!("transit bridge: upstream connect failed: {e}");
            let (mut sink, _) = ws.split();
            let _ = sink
                .send(Message::Close(Some(axum::extract::ws::CloseFrame {
                    code: 1011,
                    reason: "upstream relay unreachable".into(),
                })))
                .await;
            return;
        }
        Err(_) => {
            tracing::warn!("transit bridge: upstream connect timed out (10s)");
            let (mut sink, _) = ws.split();
            let _ = sink
                .send(Message::Close(Some(axum::extract::ws::CloseFrame {
                    code: 1011,
                    reason: "upstream relay connect timeout".into(),
                })))
                .await;
            return;
        }
    };

    tracing::info!("transit bridge: connected to upstream relay");

    let (tcp_read, tcp_write) = tcp.into_split();
    let (mut ws_sink, mut ws_stream) = ws.split();

    let ws_to_tcp_bytes = Arc::new(AtomicU64::new(0));
    let tcp_to_ws_bytes = Arc::new(AtomicU64::new(0));

    // WS → TCP: forward browser messages to upstream relay
    let ws_to_tcp_count = ws_to_tcp_bytes.clone();
    let ws_to_tcp = async move {
        let mut tcp_write = tokio::io::BufWriter::new(tcp_write);
        while let Some(msg) = ws_stream.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    let len = data.len() as u64;
                    // Use a timeout on TCP write to avoid hanging on stalled relay
                    match tokio::time::timeout(
                        Duration::from_secs(30),
                        async {
                            tcp_write.write_all(&data).await?;
                            tcp_write.flush().await
                        },
                    )
                    .await
                    {
                        Ok(Ok(())) => {
                            ws_to_tcp_count.fetch_add(len, Ordering::Relaxed);
                        }
                        Ok(Err(e)) => {
                            tracing::warn!("transit bridge: TCP write error: {e}");
                            break;
                        }
                        Err(_) => {
                            tracing::warn!("transit bridge: TCP write timeout (30s)");
                            break;
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    tracing::debug!("transit bridge: WS close frame received");
                    break;
                }
                Err(e) => {
                    tracing::warn!("transit bridge: WS read error: {e}");
                    break;
                }
                _ => {} // ignore text, ping, pong
            }
        }
        // Flush any remaining data before dropping
        let _ = tcp_write.flush().await;
        let _ = tcp_write.shutdown().await;
    };

    // TCP → WS: forward upstream relay data to browser
    let tcp_to_ws_count = tcp_to_ws_bytes.clone();
    let tcp_to_ws = async move {
        let mut tcp_read = tokio::io::BufReader::new(tcp_read);
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            // Timeout on TCP read — if the relay goes silent for 2 minutes,
            // the connection is likely dead
            match tokio::time::timeout(Duration::from_secs(120), tcp_read.read(&mut buf)).await {
                Ok(Ok(0)) => {
                    tracing::debug!("transit bridge: TCP EOF");
                    break;
                }
                Ok(Ok(n)) => {
                    tcp_to_ws_count.fetch_add(n as u64, Ordering::Relaxed);
                    if ws_sink
                        .send(Message::Binary(buf[..n].to_vec().into()))
                        .await
                        .is_err()
                    {
                        tracing::warn!("transit bridge: WS send failed");
                        break;
                    }
                }
                Ok(Err(e)) => {
                    tracing::warn!("transit bridge: TCP read error: {e}");
                    break;
                }
                Err(_) => {
                    tracing::warn!("transit bridge: TCP read timeout (120s), closing");
                    break;
                }
            }
        }
        // Send close frame to browser
        let _ = ws_sink
            .send(Message::Close(Some(axum::extract::ws::CloseFrame {
                code: 1000,
                reason: "relay closed".into(),
            })))
            .await;
    };

    // Run both directions concurrently; when either finishes, the other is dropped.
    // This is correct for a bidirectional proxy — once one side closes, the bridge
    // is no longer functional. The flush/shutdown above ensures pending data is sent.
    tokio::select! {
        _ = ws_to_tcp => tracing::debug!("transit bridge: WS→TCP finished"),
        _ = tcp_to_ws => tracing::debug!("transit bridge: TCP→WS finished"),
    }

    let elapsed = start.elapsed();
    let ws_bytes = ws_to_tcp_bytes.load(Ordering::Relaxed);
    let tcp_bytes = tcp_to_ws_bytes.load(Ordering::Relaxed);
    tracing::info!(
        "transit bridge: closed after {:.1}s (WS→TCP: {} bytes, TCP→WS: {} bytes)",
        elapsed.as_secs_f64(),
        ws_bytes,
        tcp_bytes,
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_port_stripping() {
        assert_eq!(host_without_port("wormhole.example.org"), "wormhole.example.org");
        assert_eq!(host_without_port("wormhole.example.org:8443"), "wormhole.example.org");
        assert_eq!(host_without_port("[::1]:8080"), "[::1]");
        assert_eq!(host_without_port("127.0.0.1:8080"), "127.0.0.1");
    }

    #[test]
    fn ws_origin_extraction() {
        assert_eq!(
            ws_origin("wss://relay.magic-wormhole.io:443/v1").as_deref(),
            Some("wss://relay.magic-wormhole.io:443")
        );
        assert_eq!(ws_origin(""), None);
        assert_eq!(ws_origin("https://x"), None);
    }
}
