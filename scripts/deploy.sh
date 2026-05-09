#!/usr/bin/env bash
# Rebuild and restart the Docker stack (Flowspace + Jitsi).
# Merges env.*.example into .env first (keeps passwords); then rebuilds containers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — run bootstrap once, or: npm run setup:prod -- --jitsi-host=... --public-ip=..."
  exit 1
fi

merge_dotenv() {
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  local url="${VITE_JITSI_PUBLIC_URL:-${PUBLIC_URL:-}}"
  if [[ "$url" == *localhost* ]] || [[ "${DOCKER_HOST_ADDRESS:-}" == "127.0.0.1" ]]; then
    echo "==> Merging .env from env.development.example"
    node scripts/setup-env.mjs development
  else
    echo "==> Merging .env from env.production.example (passwords unchanged)"
    node scripts/setup-env.mjs production --from-env
  fi
}

merge_dotenv

# Docker group may exist but not apply until re-login — re-exec under sg docker once.
if [[ "${FLOWSPACE_DOCKER_REEXEC:-}" != 1 ]] && ! docker info >/dev/null 2>&1; then
  if id -nG "$USER" | grep -qw docker; then
    export FLOWSPACE_DOCKER_REEXEC=1
    exec sg docker -c "cd '$ROOT' && FLOWSPACE_DOCKER_REEXEC=1 bash scripts/deploy.sh"
  fi
  echo "Docker permission denied."
  echo "  sudo usermod -aG docker $USER"
  echo "  exit   # SSH out and back in"
  echo "  cd $ROOT && npm run deploy"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

validate_docker_host_address() {
  local url="${VITE_JITSI_PUBLIC_URL:-${PUBLIC_URL:-}}"
  [[ "$url" == *localhost* ]] && return 0

  local ip="${DOCKER_HOST_ADDRESS:-}"
  if [[ -z "$ip" ]]; then
    echo ""
    echo "ERROR: DOCKER_HOST_ADDRESS is not set in .env."
    echo "  Remote participants cannot send audio/video (JVB advertises wrong ICE/colibri URLs)."
    echo "  Fix: npm run setup:prod -- --app-host=YOUR_APP --jitsi-host=YOUR_JITSI --public-ip=ELASTIC_IP"
    echo "  Then: npm run deploy"
    echo ""
    exit 1
  fi

  if [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^192\.168\. ]] || [[ "$ip" == "127.0.0.1" ]]; then
    echo ""
    echo "ERROR: DOCKER_HOST_ADDRESS=${ip} is a private/Docker address."
    echo "  Browsers cannot reach it — colibri-ws will show 172.18.x.x and remote video/audio fails."
    echo "  Set DOCKER_HOST_ADDRESS to this server's public Elastic IP (same as --public-ip in setup:prod)."
    echo ""
    exit 1
  fi

  if [[ "${ENABLE_COLIBRI_WEBSOCKET:-0}" == "1" ]]; then
    echo "==> Colibri WebSocket enabled — DOCKER_HOST_ADDRESS=${ip} (must be public IP, not 172.18.x.x)"
  else
    echo "==> Colibri WebSocket disabled (ENABLE_COLIBRI_WEBSOCKET=0) — matches Flowspace openBridgeChannel:false"
  fi
}

validate_docker_host_address

regenerate_jvb_if_needed() {
  local url="${VITE_JITSI_PUBLIC_URL:-${PUBLIC_URL:-}}"
  [[ "$url" == *localhost* ]] && return 0
  local marker="./docker/jitsi-config/.flowspace-docker-host"
  if [[ ! -f "$marker" ]] || [[ "$(cat "$marker")" != "${DOCKER_HOST_ADDRESS}" ]]; then
    echo "==> DOCKER_HOST_ADDRESS is ${DOCKER_HOST_ADDRESS} — recreating JVB (was: $(cat "$marker" 2>/dev/null || echo unset))"
    docker compose stop jvb jicofo 2>/dev/null || true
    sudo rm -rf docker/jitsi-config/jvb
    mkdir -p docker/jitsi-config/jvb
    echo "${DOCKER_HOST_ADDRESS}" > "$marker"
  fi
}

regenerate_jvb_if_needed

mkdir -p \
  docker/jitsi-config/web/crontabs \
  docker/jitsi-config/transcripts \
  docker/jitsi-config/prosody/config \
  docker/jitsi-config/prosody/prosody-plugins-custom \
  docker/jitsi-config/jicofo \
  docker/jitsi-config/jvb

# Jitsi nginx/websocket config is generated on first jitsi-web start from PUBLIC_URL.
# The nginx/ sub-dirs are written by the container as root — must use sudo to remove.
MARKER="./docker/jitsi-config/.flowspace-public-url"
if [[ ! -f "$MARKER" ]] || [[ "$(cat "$MARKER")" != "${PUBLIC_URL}" ]]; then
  echo "==> Regenerating Jitsi web config for PUBLIC_URL=${PUBLIC_URL}"
  docker compose stop jitsi-web 2>/dev/null || true
  sudo rm -rf docker/jitsi-config/web
  mkdir -p docker/jitsi-config/web/crontabs docker/jitsi-config/transcripts
  echo "${PUBLIC_URL}" > "$MARKER"
fi

echo "==> Rebuilding and restarting containers"
docker compose pull
docker compose build --pull --no-cache flowspace
docker compose up -d --remove-orphans --force-recreate jvb jicofo prosody

wait_for_jitsi_nginx() {
  echo "==> Waiting for Jitsi nginx config..."
  for _ in $(seq 1 45); do
    if [[ -f docker/jitsi-config/web/nginx/meet.conf ]]; then
      return 0
    fi
    sleep 2
  done
  echo "WARN: docker/jitsi-config/web/nginx/meet.conf not generated yet"
  return 1
}

patch_jitsi_websocket_nginx() {
  local meet_conf="docker/jitsi-config/web/nginx/meet.conf"
  local nginx_conf="docker/jitsi-config/web/nginx/nginx.conf"
  [[ -f "$meet_conf" ]] || return 0

  echo "==> Patching Jitsi nginx for WebSocket (gzip off, Connection upgrade)"
  if [[ -f "$nginx_conf" ]] && grep -q 'gzip on' "$nginx_conf"; then
    sudo sed -i 's/gzip on;/gzip off;/' "$nginx_conf"
  fi
  if grep -q 'location = /xmpp-websocket' "$meet_conf" &&
    ! grep -A10 'location = /xmpp-websocket' "$meet_conf" | grep -q 'gzip off'; then
    sudo sed -i '/location = \/xmpp-websocket {/a\    gzip off;' "$meet_conf"
  fi
  if grep -q 'location ~ \^/colibri-ws/' "$meet_conf" &&
    ! grep -A6 'location ~ \^/colibri-ws/' "$meet_conf" | head -8 | grep -q 'gzip off'; then
    sudo sed -i '/location ~ \^\/colibri-ws\//a\    gzip off;' "$meet_conf"
  fi
  sudo sed -i \
    's/proxy_set_header Connection \$connection_upgrade;/proxy_set_header Connection "upgrade";/g' \
    "$meet_conf" 2>/dev/null || true

  if docker compose ps --status running jitsi-web 2>/dev/null | grep -q jitsi-web; then
    docker compose exec -T jitsi-web nginx -t >/dev/null 2>&1 &&
      docker compose exec -T jitsi-web nginx -s reload 2>/dev/null ||
      docker compose restart jitsi-web
  fi
}

jitsi_public_host() {
  local u="${VITE_JITSI_PUBLIC_URL:-${PUBLIC_URL:-}}"
  u="${u#https://}"
  u="${u#http://}"
  u="${u%%/*}"
  echo "$u"
}

check_xmpp_websocket() {
  # Force HTTP/1.1 so we always get 101 (not HTTP/2 200 which is also valid but harder to check).
  local target="$1"
  local origin="${2:-}"
  local extra=()
  [[ -n "$origin" ]] && extra+=(-H "Origin: $origin")
  curl -si --http1.1 \
    "${extra[@]}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Protocol: xmpp" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    "$target" 2>/dev/null | head -1
}

verify_websockets() {
  local ws_host shell_line public_line app_origin spa_url
  ws_host=$(jitsi_public_host)
  app_origin="${FLOWSPACE_PUBLIC_URL:-}"
  if [[ -z "$app_origin" && -n "${FLOWSPACE_APP_HOST:-}" ]]; then
    app_origin="https://${FLOWSPACE_APP_HOST}"
  fi

  # Verify the SPA was built with the right Jitsi URL
  spa_url=$(docker compose exec -T flowspace \
    grep -roh 'https://[^/"]*duckdns[^/"]*' /usr/share/nginx/html/assets/ 2>/dev/null \
    | sort -u | head -3 || true)
  if [[ -n "$spa_url" ]]; then
    echo "  SPA Jitsi URLs in build: $spa_url"
  fi

  shell_line=$(check_xmpp_websocket "http://127.0.0.1:${HTTP_PORT:-8001}/xmpp-websocket")
  echo "  xmpp-websocket (direct): ${shell_line:-no response}"

  if [[ -n "$ws_host" ]]; then
    public_line=$(check_xmpp_websocket "https://${ws_host}/xmpp-websocket" "$app_origin")
    echo "  xmpp-websocket (Caddy):  ${public_line:-no response (check Caddy is running)}"
    if [[ "$public_line" == *"101"* ]]; then
      echo "  WebSocket OK — if Firefox fails, clear site data: Ctrl+Shift+Del → Cookies+Cache for ${ws_host}"
    else
      echo "  WARN: Caddy WebSocket not 101 — run: ./scripts/bootstrap-server.sh --skip-system --update-caddy ..."
      return 1
    fi

    if [[ "${ENABLE_COLIBRI_WEBSOCKET:-0}" == "1" ]]; then
      local colibri_ip="${DOCKER_HOST_ADDRESS:-}"
      local colibri_line
      colibri_line=$(check_xmpp_websocket "https://${ws_host}/colibri-ws/${colibri_ip}/" "$app_origin")
      echo "  colibri-ws (Caddy):      ${colibri_line:-no response}"
      if [[ "$colibri_line" != *"101"* && "$colibri_line" != *"400"* && "$colibri_line" != *"404"* ]]; then
        echo "  WARN: colibri-ws upgrade failed — remote A/V may break; check Caddy /colibri-ws and DOCKER_HOST_ADDRESS"
      fi
    fi
  fi
  [[ "$shell_line" == *"101"* ]]
}

wait_for_jitsi_nginx || true
patch_jitsi_websocket_nginx
echo "==> Waiting for Jitsi/Prosody to finish booting..."
sleep 30

echo ""
docker compose ps
echo ""
echo "Quick checks:"
curl -sfI "http://127.0.0.1:${HTTP_PORT:-8001}/" | head -1 || echo "WARN: jitsi-web not on :${HTTP_PORT:-8001}"
curl -sfI "http://127.0.0.1:${FLOWSPACE_PORT:-8780}/" | head -1 || echo "WARN: flowspace not on :${FLOWSPACE_PORT:-8780}"
if ! verify_websockets; then
  echo "  WARN: WebSocket via Caddy failed (browser uses HTTPS, not :8001)"
fi
