# Testing and documentation

Flowspace uses **three separate quality layers**. They are not interchangeable: Vitest “100% coverage” does not mean the user guide documents every feature, and passing `docs:build` does not prove the API prose is complete.

## Unit and component tests (Vitest)

- **Command:** `npm run test:coverage` (alias: `npm test`)
- **Scope:** `src-vue/**/*.{ts,vue}` except tests, `types/**`, and the interface-only `MediaService.ts`
- **Thresholds:** 100% lines, statements, functions, and branches (`vitest.config.ts`)
- **Style:** Colocated `*.test.ts` beside the module under test; pure logic extracted to `.ts` helpers when Vue SFC branch coverage is brittle

CI runs `npm run typecheck` then `npm run test:coverage` on every push and PR.

## API reference (TypeDoc)

- **Command:** `npm run docs:api` (also run as part of `npm run docs:build`)
- **Output:** Markdown under `docs-site/api/`, generated from `src-vue` via `typedoc.json`
- **What it guarantees:** Exported symbols compile and render; the site builds
- **What it does not guarantee:** Every public function has meaningful JSDoc, or that narrative guides mention new modules

Browse the generated reference from the [API index](/api/README).

## Narrative docs (VitePress)

Hand-written guides live in `docs-site/`:

| Page | Purpose |
|------|---------|
| [Getting started](/guide/getting-started) | Dev setup, env vars |
| [Deployment](/guide/deployment) | Docker / static hosting |
| [Eventyay integration](/guide/eventyay-integration) | Plugin, JWT, iframe |
| [Architecture](/architecture) | System diagram and module map |
| [Publishing docs](/guide/publishing-docs) | TypeDoc + VitePress + GitHub Pages deploy |
| **Testing** (this page) | How the layers above fit together |

There is **no automated “documentation coverage” percentage**. Keeping docs accurate is a review task when adding routes, env vars, or integration flows.

## End-to-end tests (Playwright)

- **Command:** `npx playwright test` (starts `vite preview` on port 4173 after `npm run build`)
- **Scope today:** Smoke tests for static routes and primary navigation — not full WebRTC / Jitsi conferences
- **CI:** `.github/workflows/ci.yml` job `e2e` after `test-and-build`

### What e2e does not cover yet

- Real or mocked `lib-jitsi-meet` connections (would need a test Jitsi stack or build-time mocks)
- Eventyay token exchange (covered in `useAccessGuard` unit/integration tests)
- Proximity audio, stage, chat, and screenshare interactions

### Running e2e locally

```bash
npm run build
npx playwright test
# or with UI:
npx playwright test --ui
```

To exercise **restricted join** (`/join/:id` without `?token=`), build with Eventyay env vars set (see `.env.example`) so `VITE_EVENTYAY_API_BASE` is defined; the default CI/preview build uses **open mode**.
