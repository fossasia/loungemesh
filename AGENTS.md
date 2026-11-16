# LoungeMesh AI Agent Rules & Development Standards

Welcome to the LoungeMesh codebase. All AI assistants, autonomous agents, and pair programmers modifying or contributing to this repository MUST adhere to the following rules and guidelines.

---

## 1. Architectural Guardrails

1. **Strict Adapter Boundary**:
   - UI components (`src-vue/components/`, `src-vue/pages/`) and Pinia stores (`src-vue/stores/`) **MUST NEVER** import or call `lib-jitsi-meet` directly.
   - All WebRTC, track lifecycle, and bridge communications **MUST** be routed through the `MediaService` interface (`src-vue/services/MediaService.ts`) and its implementation in `src-vue/services/JitsiAdapter.ts`.
2. **Headless WebRTC (No Iframe API)**:
   - LoungeMesh uses pure headless `lib-jitsi-meet`. Never attempt to replace this with an iframe embed or the external Jitsi Iframe API.
3. **Pinia UI State vs Engine Lifecycle Separation**:
   - Pinia stores hold reactive UI state. WebRTC track attachments, connection lifecycle events, and token refresh hooks belong in `useMediaEngine` and `JitsiAdapter`.
4. **Off-Thread Audio Calculations**:
   - Heavy math (2D avatar distance vectors and proximity audio attenuation curves) belongs in `src-vue/workers/proximityAudio.worker.ts` to keep the main UI thread at 60 fps.

---

## 2. Scalability & Resource Efficiency

1. **No Artificial Resource Constraints**:
   - **NEVER** introduce rigid container memory or CPU limits (`mem_limit`, `cpus`) in `docker-compose.yml`. Low baseline resource consumption (target: **2 vCPU / 2 GB RAM**) must be achieved by architectural design, not hard container throttling.
2. **Spatial Viewport Culling**:
   - Off-screen participants must not consume incoming video bandwidth.
   - When no participants are visible in the viewport or on stage, `buildReceiverConstraints` in `src-vue/utils/receiverConstraints.ts` must return `selectedSources = []` and `lastN = 0`.
   - Never reintroduce arbitrary fallbacks that pull video tracks for off-screen users.
3. **Video Resolution Budgeting**:
   - Avatar camera video is constrained to **360p ideal / 480p max at 24 fps**.
   - Desktop screenshare is constrained to **720p max at 15–30 fps**.
4. **State Bundling**:
   - Keep `/api/meetings/state/:roomName/init` as the primary single-roundtrip entry point for room bootstrapping. Do not decompose room entry back into sequential individual HTTP requests.
5. **Database Connection Pooling**:
   - Always ensure `connection_limit=20&pool_timeout=15` is preserved in `DATABASE_URL` configurations.

---

## 3. Security Guardrails

1. **Protect Sensitive Room Configs**:
   - **NEVER** return `joinPin` in public API responses or log it to client consoles.
   - Always sanitize meeting configurations via `sanitizeMeetingConfig` in `server/src/controllers/meetingController.ts`. Only return public fields: `allowParticipantRecording`, `lobbyEnabled`, `stagePromotionEnabled`, and `notesTemplate`.
2. **Role Verification & Authorization**:
   - Verify caller permissions before allowing mutations to room configs, whiteboard clearing, or lobby approvals.
   - Derive `meetingExists` independently from `data.role.hostId` rather than inferring existence from config presence.
3. **Secret Encryption**:
   - Third-party OAuth tokens (e.g., Google Calendar tokens) must be stored AES-256-GCM encrypted via `ENCRYPTION_KEY`.
4. **Nginx Security**:
   - Maintain client real IP extraction (`set_real_ip_from`, `real_ip_header X-Forwarded-For`) so rate limits (50 r/s burst 100) protect the service against denial-of-service abuse.

---

## 4. Testing & Code Quality Requirements

1. **100% Test Coverage Requirement**:
   - All code in `src-vue/` is subject to strict **100% statement, branch, and function coverage** thresholds.
   - Any modification or addition to Vue components, stores, composables, or utilities **MUST** be verified by running `npm test`.
2. **Server Compilation & Typecheck**:
   - Any backend TypeScript changes **MUST** compile cleanly without errors via `npm --prefix server run build`.
   - Frontend components must pass `npm run typecheck` (`vue-tsc --noEmit`).
3. **Documentation & Skill Maintenance**:
   - Whenever introducing or modifying user flows, features, or architectural components:
     - Update all documentation: root `README.md`, `server/README.md`, and relevant guides in `docs-site/`.
     - Update the corresponding domain skills in `.agents/skills/` (e.g. `loungemesh-features-and-testing`, `loungemesh-architecture`, `loungemesh-eventyay-integration`, etc.) so all AI models stay informed of new contracts and user flows.
4. **Mandatory Pre-PR / Pre-Commit Verification Checklist**:
   - Vitest unit tests with **100% statement, branch, and function coverage** (`npm test`).
   - E2E Playwright integration tests (`npm run build && npm run test:e2e`).
   - Frontend typecheck (`npm run typecheck`).
   - Server TypeScript build (`npm --prefix server run build`).
   - Docs compilation (`npm run docs:build`).

---

## 5. Git & Commit Conventions

Follow Conventional Commits:
- `feat(...)`: New features
- `fix(...)`: Bug fixes
- `perf(...)`: Performance and scaling improvements
- `test(...)`: Adding or updating tests
- `docs(...)`: Documentation updates
- `refactor(...)`: Code refactoring without behavior changes
