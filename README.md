# LoungeMesh

Spatial video lounge for informal online and hybrid events — move freely in a shared 2D space with proximity-based audio. Built for [Eventyay](https://eventyay.com) integration and self-hosted Jitsi.

**Documentation:** [docs.loungemesh.com](https://docs.loungemesh.com) — built with TypeDoc + VitePress, deployed via [GitHub Actions](.github/workflows/docs.yml) to GitHub Pages. See [Publishing docs](docs-site/guide/publishing-docs.md).

---

## Features

- **Spatial Video & Audio**: Move freely as an avatar in a 2D room with real-time audio attenuation computed off-thread via Web Audio API and Web Workers.
- **Collaborative Whiteboard**: Infinite canvas with pen, eraser, shapes, color palettes, pan/zoom navigation, and live multi-user synchronization.
- **Shared Session Notes**: Live collaborative markdown notes with optional templates, host broadcasting, and persistent state.
- **Live Polling**: Create instant single/multi-choice polls, collect anonymous votes, and publish real-time results.
- **Stage Presentation Mode**: Spotlight speakers on stage with elevated video resolution and full-screen desktop screensharing.
- **Room Access Control**: The host is the account whose email owns the meeting. Moderator and guest lists are email mappings. Someone who opens a join link is not made host just because they arrived first. People with no email, and people whose email is not on the invite list, wait in the lobby even if they have an account. The waiting screen does not show or play the meeting. Lobby is on by default.
- **Event Scheduling & Calendar Sync**: Schedule rooms with recurring rules and synchronize events directly to Google Calendar with AES-256 encrypted OAuth.
- **Ultra-Low Resource Scaling**:
  - Spatial viewport culling: camera and screenshare video are requested only for visible or on-stage peers (both the camera source and the screenshare source); off-screen peers receive no video.
  - Live notes, whiteboard, chat, reactions, and polls use JSON messages so presence stays small and the XMPP connection stays up.
  - Efficient resolution budgeting: 360p avatar camera, 720p @ 15–30 fps screenshare.
  - Single-roundtrip `/api/meetings/state/:roomName/init` endpoint bundling room state, role verification, notes, polls, whiteboard, and background.
  - Nginx rate-limiting (50 r/s burst 100) with client real-IP forwarding (`X-Forwarded-For`).
  - Prosody rate limiting (128 kb/s) and expanded stanza buffer (25 unacked stanzas).
  - Database connection pooling configured for high concurrency.

---

## Architecture & Stack

| Layer | Technologies |
|---|---|
| **Frontend SPA** | Vue 3, TypeScript, Vite, Pinia, Web Audio API, Web Workers |
| **Media Engine** | `lib-jitsi-meet` (headless WebRTC, no iframe API) |
| **Backend API** | Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Redis |
| **Media Server** | Jitsi Videobridge (JVB), Prosody XMPP, Jicofo |
| **Infrastructure** | Docker Compose, Nginx (reverse proxy, Brotli/gzip compression, CSP headers) |

---

## Quick Start

### Option 1: Full Docker Stack (Recommended)

Spins up the full stack: LoungeMesh SPA, Backend API, PostgreSQL, Redis, and Jitsi media containers.

```bash
# 1. Install dependencies and initialize environment
npm run setup

# 2. Start all Docker containers
npm run docker:up
```

- **LoungeMesh**: [http://127.0.0.1:8780](http://127.0.0.1:8780)
- **Jitsi Meet**: [http://127.0.0.1:8001](http://127.0.0.1:8001)

> **Note**: Use `127.0.0.1` for local smoke testing; some systems resolve `localhost` to IPv6 first which may reset mapped container ports.

### Option 2: Local Development Mode

Run the frontend SPA and backend API server locally with hot-reloading:

```bash
# Install root and backend dependencies
npm install
npm --prefix server install

# Initialize .env file (auto-detects local LAN IP)
npm run setup

# Run backend migrations
npm --prefix server run prisma:migrate -- --name init

# Start development servers
npm run dev                    # Frontend Vite dev server (port 5173)
npm --prefix server run dev    # Backend Express API server (port 5000)
```

---

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Run Vite development server for the Vue SPA |
| `npm run build` | Build production SPA bundle to `dist/` |
| `npm test` | Run Vitest unit tests with 100% code coverage enforcement |
| `npm run typecheck` | Run `vue-tsc` type-check across `.ts` and `.vue` files |
| `npm run docs:dev` | Run local VitePress documentation server |
| `npm run docs:build` | Build TypeDoc API reference and VitePress documentation |
| `npm run docs:preview` | Preview built documentation site locally |
| `npm run test:e2e` | Run Playwright end-to-end integration tests |
| `npm run setup` | Generate `.env` from template and detect LAN IP (`loungemesh.sh dev`) |
| `npm run docker:up` | Launch full stack in Docker Compose |
| `npm run deploy` | Rebuild and deploy Docker stack on server (`loungemesh.sh deploy`) |
| `npm run fix:jvb` | Re-advertise public IP on a running JVB instance |

Production server provisioning uses `./scripts/loungemesh.sh bootstrap` — see [Deployment Guide](docs-site/guide/deployment.md).

## Contributor & AI Agent Workflow (Pre-PR & Commit Requirements)

> [!IMPORTANT]
> **Mandatory Quality Gates Before Committing or Submitting a Pull Request:**
> 1. **All READMEs & AI Skills Must Be Updated**: Whenever introducing or modifying user flows, features, or architectural components, **all README files** ([`README.md`](README.md), [`server/README.md`](server/README.md)) and **all AI skills** in [`.agents/skills/`](.agents/skills/) **MUST be updated** to reflect the newer user flows, API contracts, and testing instructions.
> 2. **Vitest 100% Code Coverage**: Run `npm test` — all test files must pass with strict 100% statement, branch, function, and line coverage.
> 3. **E2E Integration Testing**: Run `npm run build && npm run test:e2e` — all Playwright end-to-end integration tests must pass cleanly.
> 4. **Typechecks & Server Builds**: `npm run typecheck` and `npm --prefix server run build` must compile with zero errors.

### 1. Mandatory Pre-Commit & Pre-PR Testing
- **Vitest Unit Test Suite & Coverage**:
  ```bash
  npm test
  ```
  Must pass across all test files with **100% statement, branch, function, and line coverage** enforced by `@vitest/coverage-v8`.
- **E2E Integration Tests**:
  ```bash
  npm run build && npm run test:e2e
  ```
  Playwright smoke and integration tests must pass cleanly.
- **TypeScript & Server Checks**:
  ```bash
  npm run typecheck
  npm --prefix server run build
  ```
  Zero TypeScript compiler errors in both frontend (`vue-tsc`) and backend (`tsc`).
- **Documentation Build**:
  ```bash
  npm run docs:build
  ```
  VitePress documentation and TypeDoc API references must compile with zero broken links or markdown errors.

### 2. Documentation & Agent Skills Maintenance
Whenever introducing or modifying user flows, features, or architectural components:
- **Update All READMEs**: Update the root [`README.md`](README.md), [`server/README.md`](server/README.md), and relevant guides in [`docs-site/`](docs-site/) (e.g., [`features.md`](docs-site/guide/features.md), [`scaling.md`](docs-site/guide/scaling.md), [`architecture.md`](docs-site/architecture.md)) with the newer user flows, API payloads, or config flags.
- **Update All AI Agent Skills**: Update the corresponding skill definition in [`.agents/skills/`](.agents/skills/) (e.g., `loungemesh-features-and-testing`, `loungemesh-architecture`, `loungemesh-eventyay-integration`, etc.) so all AI models (Antigravity, Gemini, Claude, Cursor, Copilot) remain aligned on the newest user flows, contracts, and security patterns.
- **Keep Agent Rules Synchronized**: Ensure [`AGENTS.md`](AGENTS.md), [`GEMINI.md`](GEMINI.md), [`CLAUDE.md`](CLAUDE.md), [`.cursorrules`](.cursorrules), and [`.github/copilot-instructions.md`](.github/copilot-instructions.md) reflect any updated development directives.

---

## License

See [LICENSE.md](LICENSE.md).
