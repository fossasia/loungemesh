# Deployment

For AWS free-tier + auto-deploy CI, see [AWS free-tier deploy](/guide/aws-deployment).

## Local / Docker

```bash
npm run setup          # env.development.example → .env (Jitsi passwords included)
npm run docker:up      # Flowspace :8780, Jitsi :8001
```

Or `docker compose up -d --build` after `npm run setup`.

## Production server

First time (or new host/IP):

```bash
npm run setup:prod -- --jitsi-host=jitsi.example.com --public-ip=1.2.3.4
npm run deploy
```

Redeploy after `git pull` — **no manual `.env` edits**; `npm run deploy` merges `env.production.example` into `.env` (passwords kept) and rebuilds.

Or use `./scripts/bootstrap-server.sh` (see AWS guide).

## Production build (static only)

```bash
npm ci
npm run build
```

`vite-plugin-compression2` emits `.gz` and `.br` siblings. Output in `dist/`.

## nginx

`nginx/default.conf.template` enables gzip_static, long-cache assets, CSP `frame-ancestors` via `NGINX_ALLOW_IFRAME_FROM`, SPA fallback.

## iframe embedding

```bash
NGINX_ALLOW_IFRAME_FROM="https://eventyay.com https://video.eventyay.com"
```

## Eventyay plugin

See [Eventyay integration](/guide/eventyay-integration).

## Docs site

See [Publishing docs](/guide/publishing-docs).
