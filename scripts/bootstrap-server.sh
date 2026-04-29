#!/usr/bin/env bash
# EC2 bootstrap: system deps, production .env, Caddy, optional deploy.
# Clone the repo yourself first, then run from that directory.
#
#   git clone git@github.com:YOU/flowspace.git ~/flowspace && cd ~/flowspace
#   ./scripts/bootstrap-server.sh \
#     --app-host=flowspace.duckdns.org \
#     --jitsi-host=jitsi.duckdns.org \
#     --public-ip=1.2.3.4 \
#     --email=you@example.com \
#     --deploy
#
# Re-login after Docker install (docker group), then re-run with --skip-system to finish.
set -euo pipefail

APP_HOST=""
JITSI_HOST=""
PUBLIC_IP=""
CADDY_EMAIL=""
SKIP_SYSTEM=0
DEPLOY_NOW=0
UPDATE_CADDY=0

usage() {
  sed -n '2,8p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-host=*) APP_HOST="${1#*=}" ;;
    --jitsi-host=*) JITSI_HOST="${1#*=}" ;;
    --public-ip=*) PUBLIC_IP="${1#*=}" ;;
    --email=*) CADDY_EMAIL="${1#*=}" ;;
    --skip-system) SKIP_SYSTEM=1 ;;
    --deploy) DEPLOY_NOW=1 ;;
    --update-caddy) UPDATE_CADDY=1 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
  shift
done

[[ -n "$JITSI_HOST" && -n "$PUBLIC_IP" ]] || usage

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as a normal user with sudo, not as root."
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ensure_caddy() {
  if command -v caddy >/dev/null; then
    sudo mkdir -p /etc/caddy
    return 0
  fi
  echo "==> Installing Caddy"
  sudo apt-get update -qq
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y caddy
  sudo mkdir -p /etc/caddy
}

if [[ "$SKIP_SYSTEM" -eq 0 ]]; then
  echo "==> System packages"
  sudo apt-get update -qq
  sudo apt-get install -y git curl ca-certificates gnupg

  echo "==> Swap (recommended on t3.micro)"
  if ! swapon --show | grep -q '/swapfile'; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi

  echo "==> Docker"
  if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed. Log out and back in, then re-run with --skip-system"
    exit 0
  fi

  sudo apt-get install -y docker-compose-plugin

  ensure_caddy
fi

cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "Run this script from your flowspace clone (after: git clone ... && cd flowspace)."
  exit 1
fi

echo "==> Production .env (merge — keeps existing passwords)"
if ! command -v node >/dev/null; then
  sudo apt-get install -y nodejs npm || true
fi
npm run setup:prod -- --app-host="$APP_HOST" --jitsi-host="$JITSI_HOST" --public-ip="$PUBLIC_IP"

APP_HOST="${APP_HOST:-$JITSI_HOST}"
APP_HOST="${APP_HOST#https://}"
APP_HOST="${APP_HOST#http://}"
JITSI_HOST="${JITSI_HOST#https://}"
JITSI_HOST="${JITSI_HOST#http://}"

ensure_caddy

if [[ "$UPDATE_CADDY" -eq 1 || ! -f /etc/caddy/Caddyfile || "$DEPLOY_NOW" -eq 1 ]]; then
  echo "==> Caddyfile (Jitsi WS/BOSH/colibri proxied on app host — same-origin for Flowspace)"
  EMAIL_LINE=""
  [[ -n "$CADDY_EMAIL" ]] && EMAIL_LINE=$'\temail '"$CADDY_EMAIL"

  sudo mkdir -p /etc/caddy
  sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
{
${EMAIL_LINE}
}

${APP_HOST} {
	route {
		# Same-origin XMPP/colibri for Flowspace (no gzip on WebSocket paths)
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

${JITSI_HOST} {
	reverse_proxy 127.0.0.1:8001 {
		transport http {
			versions 1.1
			keepalive 30s
		}
		stream_timeout 24h
	}
}
EOF

  sudo systemctl enable --now caddy
  sudo systemctl reload caddy || sudo systemctl restart caddy
else
  echo "==> Caddyfile unchanged (use --update-caddy to rewrite)"
  sudo systemctl enable --now caddy 2>/dev/null || true
fi

if [[ "$DEPLOY_NOW" -eq 1 ]]; then
  if ! id -nG "$USER" | grep -qw docker; then
    sudo usermod -aG docker "$USER"
    echo "Added $USER to docker group — SSH out and back in, then: cd $ROOT && npm run deploy"
    exit 0
  fi
  bash scripts/deploy.sh
fi

echo ""
echo "Bootstrap complete."
echo "  App:   https://${APP_HOST}"
echo "  Jitsi: https://${JITSI_HOST}"
echo "  AWS security group: TCP 22, 80, 443 and UDP 10000"
echo ""
echo "GitHub auto-deploy: set repo variable DEPLOY_HOST and secrets DEPLOY_USER / DEPLOY_SSH_PRIVATE_KEY"
