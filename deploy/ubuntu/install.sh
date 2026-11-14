#!/usr/bin/env bash
# Install a self-hosted magic-wormhole mailbox + transit relay on Ubuntu
# (26.04 LTS, amd64 or arm64; also works on other recent Debian/Ubuntu).
#
#   sudo ./install.sh                       # mailbox :4000 (plain ws), relay :4001
#   sudo ./install.sh --domain wh.example.org   # + Caddy, wss://wh.example.org (Let's Encrypt)
#
# Re-running upgrades the servers in place. Uninstall: sudo ./install.sh --uninstall
set -euo pipefail

DOMAIN=""
UNINSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:?--domain needs a value}"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
PREFIX=/opt/wormhole
DATA=/var/lib/wormhole

if [ "$UNINSTALL" -eq 1 ]; then
  systemctl disable --now wormhole-mailbox wormhole-relay 2>/dev/null || true
  rm -f /etc/systemd/system/wormhole-mailbox.service /etc/systemd/system/wormhole-relay.service
  systemctl daemon-reload
  rm -rf "$PREFIX"
  echo "Removed. Data kept in $DATA (delete it manually if unwanted)."
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip ca-certificates

id wormhole >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin wormhole
install -d -o wormhole -g wormhole -m 0750 "$DATA"
install -d "$PREFIX"

python3 -m venv "$PREFIX/mailbox"
"$PREFIX/mailbox/bin/pip" install --quiet --upgrade pip magic-wormhole-mailbox-server
python3 -m venv "$PREFIX/relay"
"$PREFIX/relay/bin/pip" install --quiet --upgrade pip magic-wormhole-transit-relay

install -m 0644 "$HERE/wormhole-mailbox.service" /etc/systemd/system/wormhole-mailbox.service
install -m 0644 "$HERE/wormhole-relay.service" /etc/systemd/system/wormhole-relay.service

if [ -n "$DOMAIN" ]; then
  # Behind Caddy the mailbox only listens on loopback.
  sed -i 's|--port=tcp:4000|--port=tcp:4000:interface=127.0.0.1|' /etc/systemd/system/wormhole-mailbox.service
  apt-get install -y -qq caddy
  printf '%s {\n\treverse_proxy 127.0.0.1:4000\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl reload-or-restart caddy
fi

systemctl daemon-reload
systemctl enable wormhole-mailbox wormhole-relay
systemctl restart wormhole-mailbox wormhole-relay

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 4001/tcp >/dev/null
  if [ -n "$DOMAIN" ]; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; else ufw allow 4000/tcp >/dev/null; fi
fi

HOSTNAME_OR_IP="${DOMAIN:-$(hostname -I | awk '{print $1}')}"
echo
echo "Done. Configure entangle clients with:"
if [ -n "$DOMAIN" ]; then echo "  export ENTANGLE_RENDEZVOUS=wss://$DOMAIN/v1"; else echo "  export ENTANGLE_RENDEZVOUS=ws://$HOSTNAME_OR_IP:4000/v1"; fi
echo "  export ENTANGLE_RELAY=$HOSTNAME_OR_IP:4001"
