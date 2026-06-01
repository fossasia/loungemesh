# LoungeMesh

Spatial video lounge for informal online and hybrid events — move freely in a shared 2D space with proximity-based audio. Built for [Eventyay](https://eventyay.com) integration and self-hosted Jitsi.

**Documentation:** [docs.loungemesh.com](https://docs.loungemesh.com) — built with TypeDoc + VitePress, deployed via [GitHub Actions](.github/workflows/docs.yml) to GitHub Pages (`DOCS_CNAME` + `DOCS_BASE_URL` repo variables). See [Publishing docs](docs-site/guide/publishing-docs.md).

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

- LoungeMesh: http://127.0.0.1:8780  
- Jitsi: http://127.0.0.1:8001  

Use `127.0.0.1` for Docker smoke tests; some systems resolve `localhost` to IPv6 first, which can reset the mapped container port.

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
| `npm run typecheck` | Type-check `.ts` and `.vue` with `vue-tsc` |
| `npm run setup` | Create `.env` for local dev + Docker (`loungemesh.sh dev`) |
| `npm run deploy` | Rebuild Docker stack on server (`loungemesh.sh deploy`) |
| `npm run fix:jvb` | Fix a JVB advertising the wrong public IP |

Production server setup uses `./scripts/loungemesh.sh bootstrap` — see
[Deployment](docs-site/guide/deployment.md).

## License

See [LICENSE.md](LICENSE.md).
