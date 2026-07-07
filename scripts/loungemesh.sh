#!/usr/bin/env bash
# LoungeMesh — one script for local dev and production.
#
# COMMANDS
#   dev        Set up local .env (auto-detects LAN IP) and optionally start Docker
#   deploy     Rebuild + restart Docker stack
#   bootstrap  Full Linux server setup: system deps, Caddy, Docker, env, deploy
#   fix-jvb    Force JVB to advertise the correct public IP (ICE broken / 172.18.x.x in logs)
#
# EXAMPLES
#   ./scripts/loungemesh.sh dev                        # local setup — zero config needed
#   ./scripts/loungemesh.sh deploy
#   ./scripts/loungemesh.sh bootstrap \
#     --app-host=loungemesh.example.com \
#     --jitsi-host=jitsi.example.com \
#     --email=admin@example.com                       # --public-ip auto-detected if omitted
#   ./scripts/loungemesh.sh fix-jvb                    # --public-ip auto-detected
#
# npm aliases: npm run setup | npm run docker:up | npm run deploy | npm run fix:jvb
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── argument parsing ──────────────────────────────────────────────────────────

COMMAND="${1:-dev}"
shift || true

APP_HOST=""
PUBLIC_IP=""
CADDY_EMAIL=""
SKIP_SYSTEM=0
DEPLOY_NOW=0
UPDATE_CADDY=0
FORCE_FLAGS=""
AUTO_IP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-host=*)      APP_HOST="${1#*=}" ;;
    --public-ip=*)     PUBLIC_IP="${1#*=}" ;;
    --email=*)         CADDY_EMAIL="${1#*=}" ;;
    --skip-system)     SKIP_SYSTEM=1 ;;
    --deploy)          DEPLOY_NOW=1 ;;
    --update-caddy)    UPDATE_CADDY=1 ;;
    --force)           FORCE_FLAGS="--force" ;;
    --rotate-passwords) FORCE_FLAGS="--rotate-passwords" ;;
    --auto-ip)         AUTO_IP=1 ;;
    -h|--help) _usage; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

_usage() {
  sed -n '2,20p' "${BASH_SOURCE[0]}"
}

# ── helpers ───────────────────────────────────────────────────────────────────

strip_proto() { echo "${1#https://}" | sed 's|^http://||' | sed 's|/$||'; }

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get install -y nodejs npm
    else
      echo "ERROR: Node.js is required. Install it from https://nodejs.org"
      exit 1
    fi
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    return 0
  fi
  # Docker group may exist but not apply until re-login
  if [[ "${LOUNGEMESH_DOCKER_REEXEC:-}" != 1 ]] && ! docker info >/dev/null 2>&1; then
    if id -nG "$USER" 2>/dev/null | grep -qw docker; then
      export LOUNGEMESH_DOCKER_REEXEC=1
      exec sg docker -c "cd '$ROOT' && LOUNGEMESH_DOCKER_REEXEC=1 bash scripts/loungemesh.sh deploy $*"
    fi
    echo "Docker permission denied. Add your user to the docker group:"
    echo "  sudo usermod -aG docker \$USER && newgrp docker"
    exit 1
  fi
}

ensure_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    sudo mkdir -p /etc/caddy
    return 0
  fi
  echo "==> Installing Caddy"
  sudo apt-get update -qq
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y caddy
  sudo mkdir -p /etc/caddy
}

merge_env() {
  local mode="$1"; shift
  ensure_node
  local extra=("$@")
  if [[ "$mode" == "prod" ]]; then
    echo "==> Merging .env from env.example (production, passwords unchanged)"
    local prod_extra=(--from-env)
    [[ ${#extra[@]} -gt 0 ]] && prod_extra+=("${extra[@]}")
    # Bootstrap may still have host/IP in shell vars when deploy runs immediately after.
    [[ -n "$PUBLIC_IP" ]] && prod_extra+=(--public-ip="$PUBLIC_IP")
    [[ -n "$APP_HOST" ]] && prod_extra+=(--app-host="$(strip_proto "$APP_HOST")")
    node scripts/setup-env.mjs production "${prod_extra[@]}" $FORCE_FLAGS
  else
    echo "==> Merging .env from env.example (development)"
    node scripts/setup-env.mjs development ${extra[@]+"${extra[@]}"}
  fi
}

detect_public_ip() {
  # Try AWS Instance Metadata Service v1 first (works on EC2 without IMDSv2 tokens),
  # then fall back to a public echo service. Returns empty string on failure.
  local ip=""
  ip=$(curl -sf --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
  if [[ -z "$ip" ]]; then
    ip=$(curl -sf --max-time 4 https://api.ipify.org 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]]; then
    ip=$(curl -sf --max-time 4 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)
  fi
  echo "${ip}"
}

detect_lan_ip() {
  # Returns the machine's LAN IP: the source address used for the default route.
  # Works on macOS and Linux; skips loopback and Docker bridge addresses.
  local ip=""
  if [[ "$(uname)" == "Darwin" ]]; then
    local iface
    iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
    [[ -n "$iface" ]] && ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    [[ -z "$ip" ]] && ip=$(ipconfig getifaddr en0 2>/dev/null || true)
    [[ -z "$ip" ]] && ip=$(ipconfig getifaddr en1 2>/dev/null || true)
  else
    ip=$(ip route get 1.1.1.1 2>/dev/null \
      | awk '/src/{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1 || true)
    [[ -z "$ip" ]] && ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  # Reject loopback and Docker bridge ranges
  if [[ "$ip" =~ ^127\. ]] || [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
    ip=""
  fi
  echo "${ip}"
}

update_ip_in_env() {
  local new_ip="$1"
  # Patch or append DOCKER_HOST_ADDRESS
  if grep -q '^DOCKER_HOST_ADDRESS=' .env; then
    sed -i.bak "s/^DOCKER_HOST_ADDRESS=.*/DOCKER_HOST_ADDRESS=${new_ip}/" .env
  else
    echo "DOCKER_HOST_ADDRESS=${new_ip}" >> .env
  fi
  # Patch or append JVB_ADVERTISE_IPS
  if grep -q '^JVB_ADVERTISE_IPS=' .env; then
    sed -i.bak "s/^JVB_ADVERTISE_IPS=.*/JVB_ADVERTISE_IPS=${new_ip}/" .env
  else
    echo "JVB_ADVERTISE_IPS=${new_ip}" >> .env
  fi
  rm -f .env.bak
  # Mark JVB config for full regeneration so it picks up the new IP
  docker compose stop jvb jicofo 2>/dev/null || true
  sudo rm -rf docker/jitsi-config/jvb
  mkdir -p docker/jitsi-config/jvb
  echo "${new_ip}" > docker/jitsi-config/.loungemesh-docker-host
  export DOCKER_HOST_ADDRESS="$new_ip"
}

detect_mode() {
  set -a; source .env 2>/dev/null || true; set +a
  local url="${VITE_JITSI_PUBLIC_URL:-${PUBLIC_URL:-}}"
  if [[ "$url" == *localhost* || "$url" == *127.0.0.1* ]]; then
    echo "dev"
  else
    echo "prod"
  fi
}

validate_docker_host() {
  local mode="$1"
  [[ "$mode" == "dev" ]] && return 0
  local ip="${DOCKER_HOST_ADDRESS:-}"
  if [[ -z "$ip" ]]; then
    echo ""
    echo "ERROR: DOCKER_HOST_ADDRESS is not set in .env."
    echo "  Remote participants cannot send audio/video (JVB advertises wrong ICE URLs)."
    echo "  Fix: ./scripts/loungemesh.sh bootstrap --app-host=... --jitsi-host=... --public-ip=ELASTIC_IP"
    echo ""
    exit 1
  fi
  if [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || \
     [[ "$ip" =~ ^10\. ]] || \
     [[ "$ip" =~ ^192\.168\. ]] || \
     [[ "$ip" == "127.0.0.1" ]]; then
    echo ""
    echo "ERROR: DOCKER_HOST_ADDRESS=${ip} is a private/Docker address."
    echo "  Browsers cannot reach it. Set it to your server's public Elastic IP."
    echo "  Then run: ./scripts/loungemesh.sh fix-jvb --public-ip=ELASTIC_IP"
    echo ""
    exit 1
  fi
  echo "==> DOCKER_HOST_ADDRESS=${ip} (public IP — OK)"
}

regenerate_jvb_if_needed() {
  local mode="$1"
  [[ "$mode" == "dev" ]] && return 0
  local marker="./docker/jitsi-config/.loungemesh-docker-host"
  local ip="${DOCKER_HOST_ADDRESS:-}"
  [[ -z "$ip" ]] && return 0
  if [[ ! -f "$marker" ]] || [[ "$(cat "$marker")" != "$ip" ]]; then
    echo "==> DOCKER_HOST_ADDRESS changed to ${ip} — recreating JVB config"
    docker compose stop jvb jicofo 2>/dev/null || true
    sudo rm -rf docker/jitsi-config/jvb
    mkdir -p docker/jitsi-config/jvb
    echo "${ip}" > "$marker"
  fi
}

regenerate_web_if_needed() {
  local marker="./docker/jitsi-config/.loungemesh-public-url"
  local url="${PUBLIC_URL:-}"
  if [[ ! -f "$marker" ]] || [[ "$(cat "$marker")" != "$url" ]]; then
    echo "==> PUBLIC_URL changed to ${url} — regenerating Jitsi web config"
    docker compose stop jitsi-web 2>/dev/null || true
    sudo rm -rf docker/jitsi-config/web
    mkdir -p docker/jitsi-config/web/crontabs docker/jitsi-config/transcripts
    echo "${url}" > "$marker"
  fi
}

ensure_jitsi_dirs() {
  mkdir -p \
    docker/jitsi-config/web/crontabs \
    docker/jitsi-config/transcripts \
    docker/jitsi-config/prosody/config \
    docker/jitsi-config/prosody/prosody-plugins-custom \
    docker/jitsi-config/jicofo \
    docker/jitsi-config/jvb
}

wait_for_jitsi_nginx() {
  echo "==> Waiting for Jitsi nginx config to generate..."
  for _ in $(seq 1 45); do
    if [[ -f docker/jitsi-config/web/nginx/meet.conf ]]; then return 0; fi
    sleep 2
  done
  echo "WARN: nginx/meet.conf not generated yet — websocket patch skipped"
  return 1
}

patch_jitsi_nginx() {
  local meet_conf="docker/jitsi-config/web/nginx/meet.conf"
  local nginx_conf="docker/jitsi-config/web/nginx/nginx.conf"
  [[ -f "$meet_conf" ]] || return 0
  echo "==> Patching Jitsi nginx for WebSocket"
  if [[ -f "$nginx_conf" ]] && grep -q 'gzip on' "$nginx_conf"; then
    sudo sed -i 's/gzip on;/gzip off;/' "$nginx_conf"
  fi
  if grep -q 'location = /xmpp-websocket' "$meet_conf" && \
     ! grep -A10 'location = /xmpp-websocket' "$meet_conf" | grep -q 'gzip off'; then
    sudo sed -i '/location = \/xmpp-websocket {/a\    gzip off;' "$meet_conf"
  fi
  if grep -q 'location ~ \^/colibri-ws/' "$meet_conf" && \
     ! grep -A6 'location ~ \^/colibri-ws/' "$meet_conf" | head -8 | grep -q 'gzip off'; then
    sudo sed -i '/location ~ \^\/colibri-ws\//a\    gzip off;' "$meet_conf"
  fi
  sudo sed -i \
    's/proxy_set_header Connection \$connection_upgrade;/proxy_set_header Connection "upgrade";/g' \
    "$meet_conf" 2>/dev/null || true
  if docker compose ps --status running jitsi-web 2>/dev/null | grep -q jitsi-web; then
    docker compose exec -T jitsi-web nginx -t >/dev/null 2>&1 && \
      docker compose exec -T jitsi-web nginx -s reload 2>/dev/null || \
      docker compose restart jitsi-web
  fi
}

check_ws() {
  local target="$1"; local origin="${2:-}"; local extra=()
  [[ -n "$origin" ]] && extra+=(-H "Origin: $origin")
  curl -si --http1.1 \
    "${extra[@]}" \
    -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Protocol: xmpp" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    "$target" 2>/dev/null | head -1
}

verify_websockets() {
  local http_port="${HTTP_PORT:-8001}"
  local loungemesh_port="${LOUNGEMESH_PORT:-8780}"
  echo "Quick checks:"
  curl -sfI "http://127.0.0.1:${http_port}/" | head -1 || \
    echo "WARN: jitsi-web not responding on :${http_port}"
  curl -sfI "http://127.0.0.1:${loungemesh_port}/" | head -1 || \
    echo "WARN: loungemesh not responding on :${loungemesh_port}"

  local ws_line
  ws_line=$(check_ws "http://127.0.0.1:${http_port}/xmpp-websocket")
  echo "  xmpp-websocket (direct): ${ws_line:-no response}"
  if [[ "$ws_line" != *"101"* ]]; then
    echo "  WARN: WebSocket not 101 — Jitsi may still be starting up"
  fi

  local pub_url="${VITE_JITSI_PUBLIC_URL:-${PUBLIC_URL:-}}"
  if [[ "$pub_url" == *https://* ]]; then
    local pub_host="${pub_url#https://}"
    local pub_line
    pub_line=$(check_ws "https://${pub_host}/xmpp-websocket" "${LOUNGEMESH_PUBLIC_URL:-}")
    echo "  xmpp-websocket (Caddy):  ${pub_line:-no response (is Caddy running?)}"
    if [[ "$pub_line" != *"101"* ]]; then
      echo "  WARN: Run ./scripts/loungemesh.sh bootstrap --update-caddy ... to refresh Caddyfile"
    fi
  fi
}

write_caddyfile() {
  local app_host="$1" jitsi_host="$2" email_line=""
  [[ -n "$CADDY_EMAIL" ]] && email_line=$'\temail '"$CADDY_EMAIL"

  local redir_block=""
  if [[ "$app_host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$app_host" == "localhost" ]]; then
    :
  elif [[ "$app_host" == www.* ]]; then
    local other_host="${app_host#www.}"
    redir_block=$'\n'"${other_host} {
	redir https://${app_host}{uri}
}"
  else
    local other_host="www.${app_host}"
    redir_block=$'\n'"${other_host} {
	redir https://${app_host}{uri}
}"
  fi

  local jitsi_block=""
  if [[ "$app_host" != "$jitsi_host" ]]; then
    jitsi_block=$'\n'"${jitsi_host} {
	route {
		handle /xmpp-websocket* {
			reverse_proxy 127.0.0.1:8001 {
				transport http {
					versions 1.1
				}
				stream_timeout 24h
			}
		}
		handle /http-bind* {
			reverse_proxy 127.0.0.1:8001
		}
		handle /colibri-ws* {
			reverse_proxy 127.0.0.1:8001 {
				transport http {
					versions 1.1
				}
				stream_timeout 24h
			}
		}
		handle {
			reverse_proxy 127.0.0.1:8001 {
				transport http {
					versions 1.1
					keepalive 30s
				}
				stream_timeout 24h
			}
		}
	}
}"
  fi

  sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
{
${email_line}
}
${redir_block}

${app_host} {
	route {
		handle /xmpp-websocket* {
			reverse_proxy 127.0.0.1:8001 {
				transport http {
					versions 1.1
				}
				stream_timeout 24h
			}
		}
		handle /http-bind* {
			reverse_proxy 127.0.0.1:8001
		}
		handle /colibri-ws* {
			reverse_proxy 127.0.0.1:8001 {
				transport http {
					versions 1.1
				}
				stream_timeout 24h
			}
		}
		handle {
			encode gzip zstd
			reverse_proxy 127.0.0.1:8780
		}
	}
}
${jitsi_block}
EOF
  sudo systemctl enable --now caddy
  sudo systemctl reload caddy || sudo systemctl restart caddy
}

# ── commands ──────────────────────────────────────────────────────────────────

cmd_dev() {
  echo "==> LoungeMesh local dev setup"
  ensure_node
  node scripts/setup-env.mjs development $FORCE_FLAGS

  # Re-detect this machine's LAN IP on every run so the config stays correct
  # after network changes (new WiFi, VPN, different subnet).
  set -a; source .env 2>/dev/null || true; set +a
  local current_ip="${DOCKER_HOST_ADDRESS:-}"
  local lan_ip
  lan_ip=$(detect_lan_ip)

  if [[ -z "$lan_ip" ]]; then
    if [[ -z "$current_ip" ]]; then
      echo "WARN: Could not detect LAN IP — remote audio/video needs DOCKER_HOST_ADDRESS in .env"
      echo "  macOS : ipconfig getifaddr en0"
      echo "  Linux : ip route get 1.1.1.1 | awk '/src/{print \$7}'"
    else
      echo "==> DOCKER_HOST_ADDRESS retained (could not re-detect): ${current_ip}"
    fi
  elif [[ "$lan_ip" == "$current_ip" ]]; then
    echo "==> DOCKER_HOST_ADDRESS up to date: ${current_ip}"
  else
    if [[ -z "$current_ip" ]]; then
      echo "==> Auto-detected LAN IP: ${lan_ip} → setting DOCKER_HOST_ADDRESS"
    else
      echo "==> LAN IP changed: ${current_ip} → ${lan_ip} — updating DOCKER_HOST_ADDRESS"
    fi
    # Remove any commented or uncommented DOCKER_HOST_ADDRESS line, then write fresh
    { grep -v '^#\? *DOCKER_HOST_ADDRESS=' .env || true; } > .env.tmp && mv .env.tmp .env
    echo "DOCKER_HOST_ADDRESS=${lan_ip}" >> .env
  fi

  echo ""
  echo "Setup complete."
  echo "  npm run dev       → Vite dev server   http://localhost:5173"
  echo "  npm run docker:up → Full stack         http://127.0.0.1:8780"
}

cmd_deploy() {
  if [[ ! -f .env ]]; then
    echo "Missing .env — run: ./scripts/loungemesh.sh dev   (or bootstrap for production)"
    exit 1
  fi
  ensure_docker

  # Re-source after potential setup-env merge
  set -a; source .env 2>/dev/null || true; set +a
  local mode
  mode=$(detect_mode)

  # --auto-ip: detect current server public IP and update .env / JVB config if it changed.
  # Used by CI deploy so Elastic IP reassignments are handled without manual steps.
  if [[ "$AUTO_IP" == 1 && "$mode" == "prod" ]]; then
    echo "==> Auto-detecting server public IP..."
    local detected_ip
    detected_ip=$(detect_public_ip)
    local current_ip="${DOCKER_HOST_ADDRESS:-}"
    if [[ -z "$detected_ip" ]]; then
      echo "WARN: Could not detect public IP (no AWS metadata, no internet?). Using existing DOCKER_HOST_ADDRESS=${current_ip}"
    elif [[ "$detected_ip" != "$current_ip" ]]; then
      echo "==> IP changed: ${current_ip:-unset} → ${detected_ip} — updating .env and wiping JVB config"
      update_ip_in_env "$detected_ip"
      # Re-read .env now that DOCKER_HOST_ADDRESS is updated
      set -a; source .env 2>/dev/null || true; set +a
    else
      echo "==> Public IP unchanged: ${detected_ip}"
    fi
  fi

  merge_env "$mode"
  set -a; source .env 2>/dev/null || true; set +a

  validate_docker_host "$mode"

  # Wipe stale Jitsi-generated configs so containers regenerate them
  # with the current env values on next start. Markers record last-used values.
  regenerate_jvb_if_needed "$mode"
  regenerate_web_if_needed
  ensure_jitsi_dirs

  echo "==> Pulling latest Jitsi images"
  docker compose pull

  echo "==> Building LoungeMesh SPA (VITE_* vars are baked into the image)"
  docker compose build --pull --no-cache loungemesh

  # --force-recreate with NO service list restarts EVERY container so each one
  # picks up the fresh .env values and the rebuilt image. Docker Compose resolves
  # the start order from depends_on: prosody → jvb + jicofo → jitsi-web → loungemesh.
  # Naming specific services here caused jitsi-web and loungemesh to be silently skipped.
  echo "==> Starting all services (prosody → jvb/jicofo → jitsi-web → loungemesh)"
  docker compose up -d --remove-orphans --force-recreate

  # jitsi-web writes its nginx config on first start after a config wipe.
  # Wait for that file, then patch WebSocket headers (gzip off, Connection: upgrade).
  wait_for_jitsi_nginx || true
  patch_jitsi_nginx

  echo "==> Waiting for all services to fully initialise..."
  sleep 20

  echo ""
  docker compose ps
  echo ""
  verify_websockets
}

cmd_bootstrap() {
  [[ -n "$APP_HOST" ]] || {
    echo "Usage: ./scripts/loungemesh.sh bootstrap --app-host=... [--public-ip=...] [--email=...] [--deploy]"
    echo "  --public-ip is optional; omit to auto-detect the server's public IP."
    exit 1
  }
  [[ "$(id -u)" -eq 0 ]] && { echo "Run as a normal user with sudo, not root."; exit 1; }

  # Auto-detect public IP if not provided
  if [[ -z "$PUBLIC_IP" ]]; then
    echo "==> Detecting server public IP (no --public-ip provided)..."
    PUBLIC_IP=$(detect_public_ip)
    if [[ -z "$PUBLIC_IP" ]]; then
      echo "ERROR: Could not auto-detect public IP. Pass --public-ip=YOUR_ELASTIC_IP explicitly."
      exit 1
    fi
    echo "==> Detected public IP: ${PUBLIC_IP}"
  fi

  if [[ "$SKIP_SYSTEM" -eq 0 ]]; then
    echo "==> System packages"
    sudo apt-get update -qq
    sudo apt-get install -y git curl ca-certificates gnupg

    echo "==> Swap (2 GB — recommended for t3.micro)"
    if ! swapon --show | grep -q '/swapfile'; then
      sudo fallocate -l 2G /swapfile
      sudo chmod 600 /swapfile
      sudo mkswap /swapfile
      sudo swapon /swapfile
      grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi

    echo "==> Docker"
    if ! command -v docker >/dev/null 2>&1; then
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker "$USER"
      sudo apt-get install -y docker-compose-plugin
      echo ""
      echo "Docker installed. Log out and back in (docker group), then re-run:"
      echo "  ./scripts/loungemesh.sh bootstrap --skip-system --app-host=${APP_HOST} --public-ip=${PUBLIC_IP} --deploy"
      exit 0
    fi
    sudo apt-get install -y docker-compose-plugin
    ensure_caddy
  fi

  [[ -f package.json ]] || { echo "Run from the loungemesh repo root."; exit 1; }

  echo "==> Production .env"
  ensure_node
  local ah
  ah=$(strip_proto "$APP_HOST")
  node scripts/setup-env.mjs production \
    --app-host="$ah" \
    --public-ip="$PUBLIC_IP" \
    $FORCE_FLAGS

  ensure_caddy

  if [[ "$UPDATE_CADDY" -eq 1 || ! -f /etc/caddy/Caddyfile || "$DEPLOY_NOW" -eq 1 ]]; then
    echo "==> Writing Caddyfile"
    write_caddyfile "$ah" "$ah"
  else
    echo "==> Caddyfile unchanged (pass --update-caddy to rewrite)"
    sudo systemctl enable --now caddy 2>/dev/null || true
  fi

  if [[ "$DEPLOY_NOW" -eq 1 ]]; then
    if ! id -nG "$USER" | grep -qw docker; then
      sudo usermod -aG docker "$USER"
      echo "Added $USER to docker group — SSH out and back in, then:"
      echo "  cd $ROOT && ./scripts/loungemesh.sh deploy"
      exit 0
    fi
    cmd_deploy
  fi

  echo ""
  echo "Bootstrap complete."
  echo "  App:   https://${ah}"
  echo "  Jitsi: https://${jh}"
  echo "  AWS security group required: TCP 22, 80, 443 and UDP 10000"
  echo ""
  echo "To deploy: ./scripts/loungemesh.sh deploy"
}

cmd_fix_jvb() {
  [[ -f .env ]] || { echo "Missing .env — run bootstrap first."; exit 1; }
  set -a; source .env 2>/dev/null || true; set +a

  # Auto-detect public IP if not provided
  if [[ -z "$PUBLIC_IP" ]]; then
    echo "==> Detecting server public IP (no --public-ip provided)..."
    PUBLIC_IP=$(detect_public_ip)
    if [[ -z "$PUBLIC_IP" ]]; then
      echo "ERROR: Could not auto-detect public IP. Pass --public-ip=YOUR_ELASTIC_IP explicitly."
      exit 1
    fi
    echo "==> Detected public IP: ${PUBLIC_IP}"
  fi

  if [[ "$PUBLIC_IP" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || \
     [[ "$PUBLIC_IP" =~ ^10\. ]] || \
     [[ "$PUBLIC_IP" =~ ^192\.168\. ]]; then
    echo "ERROR: ${PUBLIC_IP} is a private address. Use the public Elastic IP."
    exit 1
  fi

  local app_host
  app_host=$(strip_proto "${LOUNGEMESH_PUBLIC_URL:-${LOUNGEMESH_APP_HOST:-}}")

  [[ -n "$app_host" ]] || {
    echo "Set LOUNGEMESH_PUBLIC_URL in .env first."
    exit 1
  }

  echo "==> Updating DOCKER_HOST_ADDRESS and JVB_ADVERTISE_IPS to ${PUBLIC_IP}"
  ensure_node
  node scripts/setup-env.mjs production \
    --app-host="$app_host" \
    --public-ip="$PUBLIC_IP"

  # Ensure JVB_ADVERTISE_IPS is explicitly set
  if grep -q '^JVB_ADVERTISE_IPS=' .env; then
    sed -i.bak "s/^JVB_ADVERTISE_IPS=.*/JVB_ADVERTISE_IPS=${PUBLIC_IP}/" .env
  else
    echo "JVB_ADVERTISE_IPS=${PUBLIC_IP}" >> .env
  fi
  # Keep colibri-ws off until IP is confirmed working in browser
  if grep -q '^ENABLE_COLIBRI_WEBSOCKET=' .env; then
    sed -i.bak 's/^ENABLE_COLIBRI_WEBSOCKET=.*/ENABLE_COLIBRI_WEBSOCKET=0/' .env
  else
    echo 'ENABLE_COLIBRI_WEBSOCKET=0' >> .env
  fi
  rm -f .env.bak

  echo "==> Wiping cached JVB config (forces re-generation with new IP)"
  docker compose stop jvb jicofo 2>/dev/null || true
  sudo rm -rf docker/jitsi-config/jvb
  mkdir -p docker/jitsi-config/jvb
  echo "${PUBLIC_IP}" > docker/jitsi-config/.loungemesh-docker-host

  cmd_deploy

  echo ""
  echo "==> JVB container env:"
  docker compose exec -T jvb printenv DOCKER_HOST_ADDRESS 2>/dev/null || \
    echo "WARN: jvb not running yet"
  echo ""
  echo "==> JVB ICE config (should list ${PUBLIC_IP}):"
  if docker compose exec -T jvb test -f /config/jvb.conf 2>/dev/null; then
    docker compose exec -T jvb \
      grep -E 'static-mappings|local-address|websockets\.enabled|server-id' \
      /config/jvb.conf 2>/dev/null || true
    if ! docker compose exec -T jvb grep -q "${PUBLIC_IP}" /config/jvb.conf 2>/dev/null; then
      echo "WARN: ${PUBLIC_IP} not in jvb.conf — wipe docker/jitsi-config/jvb and redeploy"
    fi
  else
    echo "WARN: /config/jvb.conf not found — is jvb running?"
  fi
  echo ""
  echo "Security group: UDP ${JVB_PORT:-10000} must be open to 0.0.0.0/0"
  echo "Debug: localStorage.setItem('loungemesh:media-debug','1'); location.reload()"
}

# ── dispatch ──────────────────────────────────────────────────────────────────

case "$COMMAND" in
  dev)       cmd_dev ;;
  deploy)    cmd_deploy ;;
  bootstrap) cmd_bootstrap ;;
  fix-jvb)   cmd_fix_jvb ;;
  help|-h|--help) _usage; exit 0 ;;
  *)
    echo "Unknown command: ${COMMAND}"
    echo "Run: ./scripts/loungemesh.sh help"
    exit 1
    ;;
esac
