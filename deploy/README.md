# Self-hosting the wormhole servers

By default `entangle send`/`receive` use the public magic-wormhole servers. The
transfer is end-to-end encrypted (PAKE + secretbox), but the public mailbox and
relay still see connection metadata (who connects when, from which IP, how many
bytes). Running your own pair of servers keeps that metadata on infrastructure
you control and removes any dependence on third-party uptime.

Two small services are needed:

| Service | Port | Protocol | Role |
|---------|------|----------|------|
| mailbox (rendezvous) | 4000 | WebSocket (`/v1`) | exchanges the PAKE handshake messages |
| transit relay | 4001 | raw TCP | forwards the encrypted stream when peers cannot connect directly |

Put TLS in front of the mailbox (`wss://`). The relay carries only already
encrypted bytes and stays plain TCP.

## Point entangle at your servers

```bash
export ENTANGLE_RENDEZVOUS=wss://wormhole.example.org/v1
export ENTANGLE_RELAY=wormhole.example.org:4001
```

Both sender and receiver must use the same servers (or pass `--rendezvous` and
`--relay`). Open ports 443 (or 4000) and 4001 on your firewall.

## 1. Docker Compose (recommended)

```bash
cd deploy/docker
cp .env.example .env            # set WORMHOLE_DOMAIN
docker compose up -d            # plain: mailbox :4000, relay :4001
docker compose --profile tls up -d   # adds Caddy with automatic Let's Encrypt (wss on 443)
```

With the `tls` profile, set `MAILBOX_BIND=127.0.0.1:4000` in `.env` so the plain
port is not reachable from outside. Images are built from `deploy/docker/Dockerfile`;
set `WORMHOLE_MAILBOX_IMAGE` / `WORMHOLE_RELAY_IMAGE` to use prebuilt ones.

## 2. Kubernetes (Helm)

```bash
helm install wormhole deploy/helm/wormhole-server \
  --namespace wormhole --create-namespace \
  --set ingress.enabled=true --set ingress.className=nginx \
  --set ingress.host=wormhole.example.org \
  --set-json 'ingress.annotations={"cert-manager.io/cluster-issuer":"letsencrypt"}' \
  --set relay.service.type=LoadBalancer
```

The mailbox runs as one replica with a 1 Gi volume (SQLite). The relay is
stateless and runs 2 replicas. WebSocket needs a long idle timeout on your
ingress (see the commented annotations in `values.yaml`). The relay is raw TCP:
expose it with `LoadBalancer`, `NodePort` (`relay.service.nodePort`), or your
ingress controller's TCP support. `helm status wormhole` prints the client settings.

## 3. Kubernetes (Argo CD)

Edit `deploy/argocd/application.yaml` (host, ingress class, relay service type,
and `repoURL` if you use a fork), then:

```bash
kubectl apply -f deploy/argocd/application.yaml
```

It deploys the Helm chart above and keeps it in sync with the repository.

## 4. Ubuntu server (26.04 LTS, amd64 or arm64)

```bash
cd deploy/ubuntu
sudo ./install.sh                         # plain: ws://<ip>:4000/v1 and <ip>:4001
sudo ./install.sh --domain wormhole.example.org   # + Caddy, wss://wormhole.example.org/v1
```

Installs both servers from PyPI into virtualenvs under `/opt/wormhole`, runs
them as hardened systemd services under a dedicated `wormhole` user (data in
`/var/lib/wormhole`), and opens the ports in `ufw` if it is active. Re-run to
upgrade; `sudo ./install.sh --uninstall` removes it.

## Checking it works

```bash
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://wormhole.example.org/v1        # expect: HTTP/1.1 101 Switching Protocols
entangle send-file ./some-file --yes     # then receive it on another machine
```
