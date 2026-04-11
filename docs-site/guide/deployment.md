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

`vite-plugin-compression2` emits `.gz` and `.br` siblings for every JS/CSS/JSON bundle alongside the regular files. The build output in `dist/` is ready for deployment.

## nginx

`nginx/default.conf.template` enables:

- `gzip_static on` — serve pre-compressed `.gz` siblings without runtime CPU overhead
- Runtime gzip fallback for any file without a pre-built `.gz`
- Long-cache headers for hashed `assets/` and `libs/` (1 year immutable)
- 1-hour cache for `manifest.json`
- `Content-Security-Policy: frame-ancestors` controlled by `NGINX_ALLOW_IFRAME_FROM`
- SPA fallback to `index.html`

## iframe embedding

To allow Eventyay to embed Flowspace in an `<iframe>`, set the runtime variable:

```bash
NGINX_ALLOW_IFRAME_FROM="https://eventyay.com https://video.eventyay.com"
```

This is substituted into the `Content-Security-Policy` header at container start (no rebuild needed).

## Eventyay plugin

See [Eventyay integration](/guide/eventyay-integration) for the full plugin setup, including JWT credentials, room creation, and localhost testing.

## Docs site (`docs.yourdomain.com`)

Documentation is a **separate static site** from the Flowspace app:

- **Build:** `npm run docs:build` (TypeDoc API + VitePress guides)
- **Deploy:** GitHub Actions workflow [`.github/workflows/docs.yml`](https://github.com/eventyay/flowspace/blob/main/.github/workflows/docs.yml) → GitHub Pages
- **Custom domain:** set repository variable `DOCS_CNAME` to e.g. `docs.flowspace.com`

See [Publishing docs](/guide/publishing-docs) for the full pipeline, DNS, and `DOCS_BASE_URL` for project Pages URLs.
