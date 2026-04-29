# Flowspace

Spatial video lounge for informal online and hybrid events — move freely in a shared 2D space with proximity-based audio. Built for [Eventyay](https://eventyay.com) integration and self-hosted Jitsi.

**Documentation:** [docs.flowspace.com](https://docs.flowspace.com) — built with TypeDoc + VitePress, deployed via [GitHub Actions](.github/workflows/docs.yml) to GitHub Pages (`DOCS_CNAME` + `DOCS_BASE_URL` repo variables). See [Publishing docs](docs-site/guide/publishing-docs.md).

## Quick start

```bash
npm install
npm run setup
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Docker (SPA + Jitsi stack)

```bash
npm run setup
npm run docker:up
```

- Flowspace: http://localhost:8780  
- Jitsi: http://localhost:8001  

## Stack

- Vue 3, TypeScript, Vite, Pinia
- `lib-jitsi-meet` (headless, no iframe)
- Web Audio API for spatial gain
- Docker + nginx

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build → `dist/` |
| `npm test` | Vitest unit tests |
| `npm run docs:dev` | VitePress docs locally |
| `npm run docs:build` | Build docs to `docs-site/.vitepress/dist` |
| `npm run test:e2e` | Playwright smoke tests (after `npm run build`) |
| `npm run setup` | Create `.env` for local dev + Docker |
| `npm run setup:prod` | Create production `.env` (server) |
| `npm run deploy` | Rebuild Docker stack on server |

## License

See [LICENSE.md](LICENSE.md).
