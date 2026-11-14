# Wormhole browser page

Send and receive files from a web browser, with no software installed. It is
the companion of the entangle CLI: a teammate without entangle can open the page
to **receive the raw bundle** that `entangle send` produced, or **send a file**
that `entangle receive-file` picks up. The page also links to the latest entangle
release.

It is a client-side [Magic Wormhole](https://magic-wormhole.readthedocs.io/)
implementation (WebAssembly): keys are negotiated and data is encrypted in the
browser, so the server never sees file contents. The server only serves static
files, a `/config.json`, and a WebSocket-to-TCP bridge (`/transit`) to the
transit relay.

Detached copy of [wormhole-page](https://github.com/lucamartinetti/wormhole-page)
by Luca Martinetti (MIT), with changes by SCTG Development, see [LICENSE](LICENSE)
and [NOTICE.md](NOTICE.md) (third-party components, the Neutraface Text font):

- React 19 + [HeroUI v3](https://www.heroui.com/) + Tailwind CSS v4 interface (it was static HTML/JS),
  with the KiiK visual identity: Neutraface Text, blue/grey palette, dotted frames, light and dark themes
- five languages: en-US, fr-FR, es-ES, pt-PT, it-IT (browser language, switchable, remembered)
- the SCTG logo

- no analytics (the Umami proxy and its hard-coded site id are gone)
- runtime configuration (`/config.json`): one WASM build serves any deployment
- configurable wormhole **AppID** (default `github.com/sctg-development/entangle`)
- mailbox on the same origin (`/v1`), no hard-coded public server
- the TCP relay hint advertised to CLI peers is your own relay, not the public one
- link to the latest entangle release

## Profiles

| `WORMHOLE_PROFILE` | Mailbox | Transit relay | AppID | Use |
|---|---|---|---|---|
| `self-hosted` (default) | `/v1` on the same host (or `MAILBOX_URL`) | `TRANSIT_RELAY` (default `127.0.0.1:4001`) | `github.com/sctg-development/entangle` | your own servers |
| `official` | `wss://relay.magic-wormhole.io:443/v1` | `transit.magic-wormhole.io:4001` | `lothar.com/wormhole/text-or-file-xfer` | "universal" page that talks to any stock magic-wormhole client |

Every setting can be overridden (flag or environment variable):

| Flag | Env | Meaning |
|---|---|---|
| `--profile` | `WORMHOLE_PROFILE` | `self-hosted` or `official` |
| `--app-id` | `APP_ID` | wormhole AppID; peers meet only when it is identical |
| `--mailbox-url` | `MAILBOX_URL` | WebSocket URL of the mailbox given to browsers |
| `--transit-relay` | `TRANSIT_RELAY` | TCP `host:port` the `/transit` bridge connects to |
| `--transit-hint` | `TRANSIT_HINT` | `tcp://host:port` of the relay advertised to CLI peers (default `tcp://<page host>:4001`) |
| `--entangle-url` | `ENTANGLE_URL` | target of the "Get entangle" link |
| `--csp-connect-src` | `CSP_CONNECT_SRC` | CSP `connect-src` (default: `'self'` plus the mailbox origin) |
| `--port`, `--static-dir` | `PORT`, `STATIC_DIR` | listen port (8080) and static directory |

## Meeting entangle: the AppID

Two clients only meet on the mailbox when their AppID matches exactly. The page
and entangle (v0.8.1+) share the default `github.com/sctg-development/entangle`,
so nothing needs configuring. entangle v0.8.0 and earlier used
`github.com/gowtham-sai-yadav/claude-teleport`: run the page with
`APP_ID=github.com/gowtham-sai-yadav/claude-teleport` to serve those, or the
newer entangle with `--app-id` (see the main README).

## Deploy

Same host for everything: route `/v1` to the mailbox, all other paths to this page.

- **Docker Compose:** `docker compose --profile tls --profile web up -d` in `deploy/docker`.
- **Helm:** enabled by default (`page.enabled`).
- **Argo CD:** enabled in `deploy/argocd/application.yaml`.

The public multi-arch image is `docker.io/sctg/wormhole-page` (tags `latest`,
`0.8`, `0.8.1`), published by `.github/workflows/docker-image.yml` on each release
tag. To build it yourself (Rust server and WebAssembly are compiled inside; SRI
hashes are injected):

```bash
docker build -f Containerfile -t wormhole-page deploy/web
docker run -p 8080:8080 -e WORMHOLE_PROFILE=official wormhole-page   # universal page
```

Behind an ingress, give WebSockets (`/transit`) a long idle timeout.

## Development

Layout: `src/` React app (components, `i18n/locales/*.json`), `public/` copied as-is
(`wasm-client.js` transfer engine, `sw.js`, fonts, logo, `wasm/` generated), `scripts/postbuild.mjs`
(SRI hashes, WASM hashes, service worker precache), `crates/` Rust server and WASM client.

```bash
rustup target add wasm32-unknown-unknown   # and: cargo install wasm-pack
make wasm            # builds the WebAssembly client into public/wasm
npm ci
npm run dev          # Vite on :5173, proxying /config.json, /transit and /v1 to a server on :8080
npm run build        # tsc + vite build + postbuild -> dist/
make run             # server on :8080 serving dist/
```

Tests (Playwright, against the built app; the transfer tests also need a mailbox and
relay, e.g. `docker compose up -d` in `deploy/docker`, and skip otherwise):

```bash
npm run build && npx playwright test
```

Adding a language: copy `src/i18n/locales/en-US.json`, translate it, and register it in
`src/i18n/index.ts` (`LANGUAGES` and `resources`). Status lines coming from the transfer
engine are mapped through the `status.*` keys; error messages from the engine stay in English.

`public/wasm/`, `dist/` and `node_modules/` are generated and never committed. The
magic-wormhole library is pinned by commit in `crates/wormhole-wasm/Cargo.toml` and is
EUPL-1.2 licensed.
