# CLAUDE.md — LoungeMesh Guidelines for Claude Code

## Commands
- **Run dev server**: `npm run dev` (SPA on port 5173), `npm --prefix server run dev` (API on port 5000)
- **Run tests with coverage**: `npm test` (Runs Vitest with 100% coverage threshold)
- **Run typecheck**: `npm run typecheck` (`vue-tsc --noEmit`)
- **Build backend**: `npm --prefix server run build` (`tsc`)
- **Build docs**: `npm run docs:build` (`typedoc && vitepress build docs-site`)
- **Docker stack**: `npm run docker:up` (SPA on 8780, Jitsi on 8001)

## Architecture & Code Boundaries
- **Strict Adapter Boundary**: Vue components (`src-vue/components/`) and Pinia stores (`src-vue/stores/`) **must never** import `lib-jitsi-meet` directly. All WebRTC calls go through `MediaService.ts` / `JitsiAdapter.ts`.
- **Headless WebRTC**: No iframe API. Raw tracks are handled programmatically.
- **Off-Thread Audio Math**: Distance calculations are executed in `src-vue/workers/proximityAudio.worker.ts` and applied to Web Audio `GainNode`s with smooth exponential ramps.
- **Backend Architecture**: Express + TypeScript + Prisma ORM + PostgreSQL + Redis.

## Performance & Scalability Guardrails
- **No Artificial Memory Limits**: Never add rigid `mem_limit` in `docker-compose.yml`. Maintain low baseline resource consumption (2 vCPU / 2 GB RAM target) by design.
- **Spatial Viewport Culling**: In `src-vue/utils/receiverConstraints.ts`, off-screen peers must consume zero video streams (`selectedSources = []`, `lastN = 0`).
- **Resolution Budgeting**: Avatar camera is constrained to 360p ideal / 480p max @ 24 fps; screenshare is constrained to 720p @ 15–30 fps.
- **State Bundling**: Keep `/api/meetings/state/:roomName/init` as the single roundtrip room initialization endpoint.

## Security Directives
- **Zero PIN Exposure**: Never return `joinPin` or internal raw database strings in config responses. Always use `sanitizeMeetingConfig` in `server/src/controllers/meetingController.ts`.
- **Meeting Existence**: In `sessionFeaturesStore.ts`, derive `meetingExists` directly from `data.role.hostId` (`this.meetingExists = !!data.role.hostId`).
- **Secret Encryption**: Encrypt third-party integration secrets (e.g. Google Calendar OAuth tokens) with AES-256-GCM using `ENCRYPTION_KEY`.

## Testing Requirements & Pre-PR Verification
- **100% Coverage**: All code in `src-vue/` requires 100% statement, branch, function, and line coverage. Always verify with `npm test`.
- **E2E Testing**: Run `npm run build && npm run test:e2e` to verify Playwright integration tests pass cleanly.
- **Typechecks & Build**: `npm run typecheck` and `npm --prefix server run build` must compile without errors.

## Documentation & AI Skills Maintenance
- Whenever introducing or modifying user flows, features, or architectural components:
  - Update all READMEs (`README.md`, `server/README.md`) and guides in `docs-site/`.
  - Update relevant domain skills in `.agents/skills/` so all AI assistants and contributors stay aligned on the newest user flows and contracts.

## Specialized Skills
Consult domain skills in `.agents/skills/`:
- `loungemesh-architecture`: Multi-tier system architecture and adapter contracts
- `loungemesh-scaling`: Viewport culling algorithms and stream budgeting
- `loungemesh-security`: Credential protection and role authorization
- `loungemesh-eventyay-integration`: Token exchange and postMessage bridge
- `loungemesh-deployment`: `scripts/loungemesh.sh` CLI workflows and Prosody patching
- `loungemesh-features-and-testing`: User flows and 100% test coverage standards
