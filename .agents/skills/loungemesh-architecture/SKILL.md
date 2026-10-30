---
name: loungemesh-architecture
description: >-
  Comprehensive guide to LoungeMesh architecture across Vue 3 SPA, headless WebRTC JitsiAdapter,
  Web Audio engine, Express backend, PostgreSQL (Prisma), Redis, and Eventyay token bridge.
---

# LoungeMesh Architecture Skill

This skill explains the architectural layers and component interactions of LoungeMesh. Use this skill when designing features, refactoring components, or understanding data flow across the system.

---

## 1. Multi-Tier System Overview

LoungeMesh consists of four distinct architectural tiers:

1. **Frontend SPA (`src-vue/`)**:
   - Built with Vue 3 (Composition API), Vite, TypeScript, and Pinia.
   - Manages the 2D interactive lounge canvas, viewport panning/zooming, and UI state.
2. **Audio/Video Media Engine (`src-vue/services/` & `src-vue/composables/`)**:
   - Headless WebRTC integration via `lib-jitsi-meet`.
   - Web Audio API pipeline routing each remote audio track through dedicated `GainNode` instances for spatial distance attenuation.
   - Dynamic viewport culling via `receiverConstraints.ts`.
3. **Backend API (`server/`)**:
   - Node.js, Express, TypeScript, Prisma ORM.
   - Provides meeting scheduling, role resolution, bundled room state (`/init`), and session auditing.
   - Persistent store: PostgreSQL.
   - Fast cache and pub/sub: Redis.
4. **Media Infrastructure (`docker/`)**:
   - Jitsi Videobridge (JVB), Prosody XMPP, Jicofo Focus.
   - Nginx reverse proxy with real client IP forwarding and CSP header injection.

---

## 2. Frontend Layering & Adapter Boundary

```
UI Layer (Vue Components / Pages)
       ↓
State Layer (Pinia Stores: localStore, conferenceStore, sessionFeaturesStore)
       ↓
Engine Coordinator (`useMediaEngine.ts`)
       ↓
Contract Interface (`MediaService.ts`)
       ↓
Adapter Implementation (`JitsiAdapter.ts`)
       ↓
WebRTC Driver (`lib-jitsi-meet`) & Audio Engine (Web Audio API)
```

### Critical Rules
- **No Direct Jitsi Imports**: UI components and Pinia stores must never import from `lib-jitsi-meet`. All calls must flow through `MediaService`. Desktop screenshare stays 720p at 15–30 fps. Phone capture omits desktop source locks and falls back to `getDisplayMedia` inside `JitsiAdapter`.
- **Decoupled Stores**:
  - `localStore.ts`: Manages local user identity, 2D avatar coordinates `(x, y)`, mic/camera states, and screen calculation triggers.
  - `conferenceStore.ts`: Tracks remote participants, active connection states, and track mappings.
  - `sessionFeaturesStore.ts`: Tracks whiteboard strokes, notes, polls, stage mode, room defaults, and role verification.

---

## 3. Spatial Audio & Web Worker Pipeline

1. When avatars move or the viewport is panned, `calculateUsersOnScreen()` in `localStore` triggers proximity calculations.
2. The distance vector between the local avatar and each remote avatar is dispatched to `src-vue/workers/proximityAudio.worker.ts`.
3. The worker calculates distance-based attenuation without blocking the main rendering thread.
4. `JitsiAdapter` updates the `GainNode.gain` values using exponential smoothing ramps (`setTargetAtTime`) to avoid clicks and pops.

---

## 4. Backend & Room State Bundling

To avoid cascading HTTP requests when entering a room, the frontend queries:
```
GET /api/meetings/state/:roomName/init
```
Handled by `getRoomInitialState` in `server/src/controllers/meetingController.ts`:
- Concurrently queries PostgreSQL (Prisma) and Redis keys (`whiteboard`, `notes`, `access`, `poll`, `background`).
- Sanitizes room configuration using `sanitizeMeetingConfig` (omits `joinPin` and internal tables).
- Resolves caller role (`host`, `moderator`, `attendee`).
- Returns a single unified response payload.

### Real-time session commands
Sticky state (`pos`, `name`, `host`, `access`, `config`, `hand`) is carried in XMPP presence. Collaborative and ephemeral events (notes, whiteboard, chat, reactions, polls, stage, lobby, room background) are `lm-cmd` JSON messages so a burst cannot bloat presence or disconnect the participant. `JitsiAdapter` spaces those messages by 25ms. Per-person access commands apply from the host or a moderator. Room-wide config, lobby enablement, and presenter promotion apply only from the host. Background changes apply from the host or a moderator. A stranger's command is ignored. An enabled room feature is usable by every attendee unless that person's grant is explicitly `false`. Notes and whiteboard publishes are applied immediately. A notes template is written into the Y.Doc and broadcast as `yjs_*` chunks. The host repeats grants, config, and a background reload on the session heartbeat. The host role comes from the meeting owner's email, not from who joined first. A `host` presence command is applied only when its email matches that owner. Lobby is on until the meeting config says otherwise. `lobbyForm` is `name` (default) or `details`. Anyone who is not the host, a moderator, or an invited email waits, and their media is held until admission. A hello that carries the signed-in account email is admitted when that email is the host, a moderator, or a guest. A person who is not on the invite list stays held.
