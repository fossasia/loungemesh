# Flowspace

Spatial video lounge for informal online and hybrid events — move freely in a shared 2D space with proximity-based audio. Built for [Eventyay](https://eventyay.com) integration and self-hosted Jitsi.

**Documentation:** [docs.flowspace.com](https://docs.flowspace.com) (configure via GitHub Pages + `DOCS_CNAME`)

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Docker (SPA + Jitsi stack)

```bash
npm run docker:jitsi-env
npm run docker:up
```

- Flowspace: http://localhost:8880  
- Jitsi: see `docker/env.jitsi.example`

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

## License

See [LICENSE.md](LICENSE.md).
