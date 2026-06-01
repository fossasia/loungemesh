# Deployment

Everything (local dev and production) runs through a single script,
`scripts/loungemesh.sh`, and a single template, `env.example`. There are no
separate `env.development.example` / `env.production.example` files and no
per-task scripts to remember.

For a step-by-step AWS free-tier walkthrough with HTTPS, see
[AWS free-tier deploy](/guide/aws-deployment).

## Local / Docker

```bash
npm run setup          # = loungemesh.sh dev: writes .env, auto-detects your LAN IP
npm run docker:up      # LoungeMesh :8780, Jitsi :8001
```

`npm run setup` needs **zero configuration** — it copies `env.example` to `.env`
(generating Jitsi passwords) and fills `DOCKER_HOST_ADDRESS` with your detected
LAN IP so other devices on the network can reach the bridge.

## Production server

First time on a fresh Linux host (installs Docker + Caddy, writes `.env`, gets
HTTPS certificates, and deploys):

```bash
./scripts/loungemesh.sh bootstrap \
  --app-host=loungemesh.example.com \
  --jitsi-host=jitsi.example.com \
  --email=admin@example.com \
  --deploy
# --public-ip is auto-detected from the host; pass --public-ip=1.2.3.4 to override
```

Redeploy after `git pull`:

```bash
npm run deploy         # = loungemesh.sh deploy
```

`deploy` re-merges `.env` from `env.example` (**existing passwords and keys are
kept**) and rebuilds. No manual `.env` edits are needed.

### Dynamic / changing public IP

If the server's public IP can change (e.g. an Elastic IP is reassigned), deploy
with `--auto-ip` so `DOCKER_HOST_ADDRESS` is re-detected on every deploy:

```bash
./scripts/loungemesh.sh deploy --auto-ip
```

This is exactly what CI runs, so auto-deploys keep working across IP changes.

## CI / auto-deploy

`.github/workflows/ci.yml` runs typecheck, unit tests with coverage, build, docs
build, a Docker Compose config validation, and Playwright e2e. On a push to
`main`/`master`/`dev` it deploys over SSH **only if** the `DEPLOY_HOST` Actions
variable is set. The deploy step runs `loungemesh.sh deploy --auto-ip` on the
server, so it tolerates IP changes.

Required GitHub **Actions variables / secrets**:

| Kind | Name | Value |
|------|------|-------|
| Variable | `DEPLOY_HOST` | Server public IP / hostname |
| Variable | `DEPLOY_PATH` | App dir on server (optional, default `/opt/loungemesh`) |
| Secret | `DEPLOY_USER` | SSH user (e.g. `ubuntu`) |
| Secret | `DEPLOY_SSH_PRIVATE_KEY` | Private key for that user |

`.env` is never committed; CI only ever copies `env.example`, so no real secrets
live in GitHub.

## Fixing a broken bridge (no audio/video)

If browser logs show `colibri-ws/172.18.0.x` (the Docker bridge IP) instead of
your public IP, the JVB is advertising the wrong address. Fix the running bridge
without a full redeploy:

```bash
npm run fix:jvb        # = loungemesh.sh fix-jvb, public IP auto-detected
```

## Production build (static only)

```bash
npm ci
npm run build
```

`vite-plugin-compression2` emits `.gz` and `.br` siblings. Output in `dist/`.

## nginx

`nginx/default.conf.template` enables `gzip_static`, long-cache assets, an SPA
fallback, a CSP `frame-ancestors` controlled by `NGINX_ALLOW_IFRAME_FROM`, and a
same-origin `/libs/` proxy to the `jitsi-web` container so `lib-jitsi-meet` is
always served from the exact image/tag the JVB runs (no vendored copies to drift).

## iframe embedding

```bash
NGINX_ALLOW_IFRAME_FROM="https://eventyay.com https://video.eventyay.com"
```

## Eventyay plugin

See [Eventyay integration](/guide/eventyay-integration).

## Docs site

See [Publishing docs](/guide/publishing-docs).
