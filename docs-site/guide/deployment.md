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

## Docs site (`docs.yourdomain.com`)

Documentation is a **separate static site** from the Flowspace app:

- **Build:** `npm run docs:build` (TypeDoc API + VitePress guides)
- **Deploy:** GitHub Actions workflow [`.github/workflows/docs.yml`](https://github.com/eventyay/flowspace/blob/main/.github/workflows/docs.yml) → GitHub Pages
- **Custom domain:** set repository variable `DOCS_CNAME` to e.g. `docs.flowspace.com`

See [Publishing docs](/guide/publishing-docs) for the full Sphinx/autodoc-style pipeline, DNS, and `DOCS_BASE_URL` for project Pages URLs.
