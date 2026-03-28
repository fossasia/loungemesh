# Deployment

## Docker (recommended)

```bash
npm run docker:jitsi-env
npm run docker:up
```

- Flowspace SPA: `http://localhost:8880`
- Jitsi web: port `8001` (see `docker/env.jitsi.example`)

Build args for the SPA image: `VITE_JITSI_PUBLIC_URL`, `VITE_XMPP_DOMAIN`, `VITE_XMPP_MUC_DOMAIN`, `VITE_SESSION_PREFIX`.

## Production build

```bash
npm ci
npm run build
```

Serve `dist/` with nginx or any static host. SPA fallback to `index.html` is required.

## nginx

The included [`nginx/default.conf`](https://github.com/eventyay/flowspace/blob/main/nginx/default.conf) enables gzip, long-cache for hashed assets, and SPA routing.

## Docs site

```bash
npm run docs:build
```

Deploy `docs-site/.vitepress/dist` to GitHub Pages or any static host. Set repository variable `DOCS_CNAME` to `docs.flowspace.com` (or your domain) for custom DNS.
