#!/usr/bin/env bash
# Force JVB to advertise a public IP (not 172.18.x.x) for ICE and colibri-ws.
#
# Run ON THE EC2 SERVER from the repo root:
#   ./scripts/fix-jvb-advertise.sh 13.62.178.111
#
# Or with hosts read from existing .env (still pass public IP):
#   ./scripts/fix-jvb-advertise.sh 13.62.178.111
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PUBLIC_IP="${1:-}"
if [[ -z "$PUBLIC_IP" ]]; then
  echo "Usage: $0 PUBLIC_ELASTIC_IP"
  echo "  Example: $0 13.62.178.111"
  exit 1
fi

if [[ "$PUBLIC_IP" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || [[ "$PUBLIC_IP" =~ ^10\. ]] || [[ "$PUBLIC_IP" =~ ^192\.168\. ]]; then
  echo "ERROR: $PUBLIC_IP looks like a private address. Use the EC2 Elastic IP."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env — run bootstrap or setup first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

APP_HOST="${FLOWSPACE_APP_HOST:-}"
JITSI_HOST="${PUBLIC_URL:-}"
JITSI_HOST="${JITSI_HOST#https://}"
JITSI_HOST="${JITSI_HOST#http://}"
JITSI_HOST="${JITSI_HOST%%/*}"

if [[ -z "$APP_HOST" ]]; then
  APP_HOST="${FLOWSPACE_PUBLIC_URL:-}"
  APP_HOST="${APP_HOST#https://}"
  APP_HOST="${APP_HOST#http://}"
  APP_HOST="${APP_HOST%%/*}"
fi

if [[ -z "$APP_HOST" || -z "$JITSI_HOST" ]]; then
  echo "Set FLOWSPACE_APP_HOST / PUBLIC_URL in .env, or pass hosts:"
  echo "  APP_HOST=eventyayflowspace.duckdns.org JITSI_HOST=jitsi-eventyayflowspace.duckdns.org $0 $PUBLIC_IP"
  exit 1
fi

echo "==> Setting DOCKER_HOST_ADDRESS=${PUBLIC_IP} (app=${APP_HOST}, jitsi=${JITSI_HOST})"
node scripts/setup-env.mjs production \
  --app-host="$APP_HOST" \
  --jitsi-host="$JITSI_HOST" \
  --public-ip="$PUBLIC_IP"

# Explicit ICE advertise (jitsi 10-config also copies from DOCKER_HOST_ADDRESS when empty)
if grep -q '^JVB_ADVERTISE_IPS=' .env; then
  sed -i.bak "s/^JVB_ADVERTISE_IPS=.*/JVB_ADVERTISE_IPS=${PUBLIC_IP}/" .env
else
  echo "JVB_ADVERTISE_IPS=${PUBLIC_IP}" >> .env
fi

# Stop broken colibri until IP is verified in the browser (optional: set to 1 later)
if grep -q '^ENABLE_COLIBRI_WEBSOCKET=' .env; then
  sed -i.bak 's/^ENABLE_COLIBRI_WEBSOCKET=.*/ENABLE_COLIBRI_WEBSOCKET=0/' .env
else
  echo 'ENABLE_COLIBRI_WEBSOCKET=0' >> .env
fi
rm -f .env.bak

echo "==> Wiping cached JVB config (forces new advertise address)"
docker compose stop jvb jicofo 2>/dev/null || true
sudo rm -rf docker/jitsi-config/jvb
mkdir -p docker/jitsi-config/jvb
echo "${PUBLIC_IP}" > docker/jitsi-config/.flowspace-docker-host

echo "==> Deploying stack"
bash scripts/deploy.sh

echo ""
echo "==> JVB container env (should show ${PUBLIC_IP}):"
docker compose exec -T jvb printenv DOCKER_HOST_ADDRESS 2>/dev/null || echo "WARN: jvb not running yet"

echo ""
echo "==> Generated /config/jvb.conf (ICE must list ${PUBLIC_IP} in static-mappings):"
if docker compose exec -T jvb test -f /config/jvb.conf 2>/dev/null; then
  docker compose exec -T jvb grep -E 'static-mappings|local-address|websockets\.enabled|server-id' /config/jvb.conf 2>/dev/null || true
  if ! docker compose exec -T jvb grep -q "${PUBLIC_IP}" /config/jvb.conf 2>/dev/null; then
    echo "WARN: ${PUBLIC_IP} not found in jvb.conf — wipe docker/jitsi-config/jvb and redeploy"
  fi
else
  echo "WARN: jvb.conf missing — is jvb running?"
fi

echo ""
echo "Rebuild Flowspace after pulling app fixes: docker compose build flowspace && docker compose up -d flowspace"
echo "Browser: localStorage.setItem('flowspace:media-debug','1'); reload — expect TRACK_ADDED local:false"
echo "Security group: UDP ${JVB_PORT:-10000} open to the internet"
