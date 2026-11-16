# Deployment

LoungeMesh deployment is unified across local testing and production through a single automation script, `scripts/loungemesh.sh`, and configuration template, `env.example`.

For a step-by-step AWS free-tier walkthrough with HTTPS, see [AWS free-tier deploy](/guide/aws-deployment).

---

## Architecture of the Deployed Stack

The production Docker Compose deployment comprises the following coordinated services:

| Container | Image / Source | Role |
|---|---|---|
| `loungemesh` | Custom Dockerfile | Vue 3 SPA frontend & Express REST API server |
| `postgres` | `postgres:15-alpine` | Relational database (Prisma ORM) |
| `redis` | `redis:7-alpine` | In-memory session cache for whiteboard, notes & polls |
| `jitsi-web` | `jitsi/web` | Jitsi Meet web server & Nginx proxy |
| `prosody` | `jitsi/prosody` | XMPP signaling server with auto-tuned rate limits |
| `jicofo` | `jitsi/jicofo` | Focus component managing conference bridge channels |
| `jvb` | `jitsi/jvb` | Jitsi Videobridge forwarding WebRTC audio/video |

---

## Local / Staging Docker Deployment

```bash
# 1. Generate .env and auto-detect LAN/Docker host IP
npm run setup

# 2. Start all services
npm run docker:up
```

`npm run setup` copies `env.example` to `.env` (generating strong cryptographically secure passwords for Jitsi and database services) and detects `DOCKER_HOST_ADDRESS`.

---

## Production Server Provisioning

### First-Time Bootstrap
On a fresh Linux host (Ubuntu 22.04+ or Debian 12), the bootstrap command installs Docker and Caddy, creates `.env`, provisions Let's Encrypt HTTPS certificates, and deploys the stack:

```bash
./scripts/loungemesh.sh bootstrap \
  --app-host=loungemesh.example.com \
  --email=admin@example.com \
  --deploy
```
*`--public-ip` is auto-detected; pass `--public-ip=1.2.3.4` to override explicitly if behind a NAT.*

### Redeploying After Updates
After pulling the latest code via git:

```bash
npm run deploy         # = ./scripts/loungemesh.sh deploy
```

`deploy` safely re-merges `.env` with `env.example` (**preserving existing database secrets, JWT keys, and passwords**) and initiates a rebuild:
1. Re-validates the host address.
2. Builds the LoungeMesh SPA with production Brotli/gzip compression.
3. Automatically awaits Prosody configuration files via `wait_for_prosody_config` (90s finite deadline).
4. Applies Prosody rate limit (128 kb/s) and stream buffer (25 stanzas) patches.
5. Reloads Prosody safely (`prosodyctl reload`).
6. Verifies WebSocket endpoints on the bridge.

### Dynamic Public IP Handling
If the host server IP can change (e.g., an AWS EC2 instance without an Elastic IP), pass `--auto-ip`:

```bash
./scripts/loungemesh.sh deploy --auto-ip
```

---

## CI / Auto-Deployment

`.github/workflows/ci.yml` runs type-checking, unit tests with 100% coverage, production builds, docs build, Docker config validation, and Playwright e2e tests.

On merges to `main`, CI triggers deployment over SSH if the `DEPLOY_HOST` variable is configured.

### Required GitHub Secrets & Variables
| Kind | Name | Description |
|---|---|---|
| Variable | `DEPLOY_HOST` | Server public IP or domain name |
| Variable | `DEPLOY_PATH` | Application directory on server (default: `/opt/loungemesh`) |
| Secret | `DEPLOY_USER` | SSH user (e.g., `ubuntu`) |
| Secret | `DEPLOY_SSH_PRIVATE_KEY` | Private SSH key for automated deployment |

---

## Fixing Bridge IP Advertisement

If client browser logs report `colibri-ws/172.18.0.x` (internal Docker IP) instead of the server's public IP, the bridge is advertising the internal container IP. Fix it in place:

```bash
npm run fix:jvb        # Auto-detects public IP and reconfigures JVB
```

---

## Nginx & Security Headers

The reverse proxy configuration (`nginx/default.conf.template`) includes:
- **Client Real-IP Extraction**: `set_real_ip_from` and `real_ip_header X-Forwarded-For` so rate limits accurately track client origins.
- **Rate Limiting**: `50r/s burst=100` protecting API and media signaling from abuse.
- **CSP Frame Ancestors**: Configured via `NGINX_ALLOW_IFRAME_FROM` to allow embedding within Eventyay portals:
  ```bash
  NGINX_ALLOW_IFRAME_FROM="https://eventyay.com https://video.eventyay.com"
  ```
- **Static Asset Caching**: 1-year immutable cache headers for hashed Vite chunks and pre-compressed `.br` / `.gz` files.
