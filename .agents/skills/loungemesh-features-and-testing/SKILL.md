---
name: loungemesh-features-and-testing
description: >-
  Complete guide to LoungeMesh user flows (entry, devices, spatial audio, stage, whiteboard, notes,
  polls, moderation, calendar, resilience) and 100% test coverage standards with Vitest and Playwright.
---

# LoungeMesh Features & Testing Skill

This skill documents all critical user flows in LoungeMesh and outlines testing standards to maintain the mandatory **100% test coverage** requirement.

---

## 1. Critical User Flows Checklist

When developing or modifying features, verify that the following user flows function correctly:

1. **Room Entry & Access Control**:
   - Direct Join: Name input & avatar selection.
   - Eventyay Gated Entry: Opaque token exchange, Jitsi JWT generation, capability assignment.
   - PIN Protection: Modal challenge, verification against backend, rejection on invalid PIN without leaking `joinPin`.
   - Lobby & Admission: invited emails enter directly. Everyone else waits. The default form asks only for a name; the details form also requires an email. Nothing is prefilled. A waiting client does not publish camera or microphone, and people already inside do not see or hear them. Cancel and leave clear the host's knock list. Only the host or a moderator can deny entry. Admit and deny apply as the command arrives.
   - Host Key Claim: Unlocking host privileges with host key.
2. **Media Device Negotiation**:
   - Mic/Camera permission granting or graceful denial.
   - Device selector modal (audio input, video input, audio output).
   - Speaking level indicator (Web Audio analyser lighting up avatar ring).
3. **2D Spatial Canvas & Proximity Audio**:
   - Avatar movement via mouse drag and keyboard arrow/WASD keys.
   - Canvas pan and zoom.
   - Off-thread distance calculation (`proximityAudio.worker.ts`).
   - Exponential volume attenuation via Web Audio `GainNode`s.
4. **Stage Presentation & Screensharing**:
   - Stage promotion, invitation, & demotion by host or moderator (`canPromoteToStage`). Invited presenters can also publish `promote` when going live from preview.
   - Stage occupants spotlighted with 720p receiver video constraint (`STAGE_MAX_HEIGHT = 720`).
   - Screensharing with system audio captured at 720p @ 15–30 fps via headless multi-stream flags (`sourceNameSignaling`, `sendMultipleVideoStreams`, `receiveMultipleVideoStreams`) so toggling camera never tears down an active screenshare.
5. **In-Room Collaborative Tools**:
   - Collaborative Whiteboard: Freehand pen, lines, rectangles, circles, eraser, palette, stroke sync, clear/reset.
   - Shared Notes: Real-time debounced markdown editing. A host template is written into the Y.Doc and broadcast immediately. Attendees publish notes without a moderation queue. Markdown export.
   - Live Polling: Create poll, anonymous voting, real-time vote tally, reveal/close.
6. **Moderation & Room Administration**:
   - Top-left header pill (`AppHeader.vue`): Shows `Connecting…` / `In lobby` while joining, and badges only `Host` / `Moderator` once in the room (never `Attendee`).
   - Host room settings modal: Left-aligned grouped cards with accessible switches for feature toggles (chat, notes, whiteboard, poll, stage), lobby policy, and default feature chips.
   - Moderator resolution & assistance: Email-invited (`moderatorEmails`), bridge-property (`role: 'moderator'`), and runtime-granted (`userGrants[id].moderator`) moderators are consistently badged as `Moderator` and can manage polls, promote presenters to stage, and moderate attendees.
   - Live attendee invitation (`Add`) & meeting link sharing (`Share`): Hosts and moderators (never regular attendees) can invite attendee emails in-call (`POST /api/meetings/state/:roomName/invite` + XMPP `lobby` `action: 'invite'` + automatic lobby admission for matching emails) and copy/share `/session/:roomName` from the top-right quick bar or the `People` tab.
   - Soft mute (`mute`), soft disable camera (`camera_off`), per-attendee force-lock mic & camera (`lock_media` / `mediaLocks`), & kick attendee (`kick`, redirected to `/kicked`).
   - Custom floorplan wallpaper update via upload (persisted via 2 MB Express JSON limit + `cache: 'no-store'` reload, with automatic chunked XMPP fallback when unpersisted).
7. **Scheduling & Calendar Sync**:
   - Meeting schedule modal with recurrence rules and email invites.
   - Google Calendar two-way synchronization via AES-256 encrypted OAuth.
8. **Network Resilience & Recovery**:
   - Automatic WebRTC reconnection on network drop.
   - Live notes, whiteboard, chat, reactions, and polls travel as JSON messages, not presence, so a burst cannot drop the XMPP connection.
   - The meeting owner's email is the host. Moderator and guest emails are invited. A join link does not promote the first arrival to host. People with no email, or an email that is not invited, are attendees and wait in the lobby. Lobby defaults to on. When the host enables notes, whiteboard, polls, or chat, attendees can use them. The host changes room-wide settings, including presenter promotion. Host and moderator start and end polls, change the floor background and notes template, and can revoke or restore one person. Attendees vote. A control that role cannot use is hidden. Grants, the notes template, and the floor background are delivered live and repeated on the host heartbeat.
   - The floor starts at a scale that keeps a sphere a small part of the shorter screen side, and zoom can go further in. Session panels, chat, whiteboard, and the screenshare strip use the width above the footer. A shared screen is visible to every admitted person, including the sharer. Phone screenshare capture omits desktop source locks and falls back to `getDisplayMedia`. The meeting floor stays hidden until entry is known.
   - Automatic token renewal on `AUTHENTICATION_REQUIRED`.
   - Graceful fallback from single-roundtrip `/init` to parallel individual endpoints.

---

## 2. 100% Test Coverage & Quality Gates

Vitest is configured with `@vitest/coverage-v8` with strict thresholds across all `src-vue/` code:
```js
coverage: {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
}
```

### Pre-PR / Pre-Commit Verification Checklist
Before submitting any pull request or committing code, execute:
1. **Vitest Unit Test Suite & Coverage**:
   ```bash
   npm test
   ```
   Must pass across all 159 test files with **100% statement, branch, function, and line coverage**.
2. **Playwright E2E Integration Tests**:
   ```bash
   npm run build && npm run test:e2e
   ```
   Ensures critical user flows (room join, stage promotion, whiteboard, notes, polls) function in headless Chromium.
3. **TypeScript Typecheck**:
   ```bash
   npm run typecheck
   ```
   Zero errors across `.vue` and `.ts` files.
4. **Backend TypeScript Build**:
   ```bash
   npm --prefix server run build
   ```
5. **Documentation Build**:
   ```bash
   npm run docs:build
   ```

### Documentation & Skills Maintenance Workflow
Whenever adding, updating, or refactoring user flows:
- **Update All READMEs**: Update the root `README.md`, `server/README.md`, and relevant guides in `docs-site/` (e.g. `docs-site/guide/features.md`).
- **Update AI Skills**: Update this skill (`loungemesh-features-and-testing`) and any affected domain skills in `.agents/skills/` (such as `loungemesh-eventyay-integration` or `loungemesh-architecture`) so all AI models and human developers have up-to-date user flow contracts and test harnesses.

### Testing Invariants & Best Practices
1. **Mocking Pinia Stores**:
   ```ts
   beforeEach(() => {
     setActivePinia(createPinia());
   });
   ```
2. **Mocking WebRTC & Adapter**:
   - Use test helpers in `src-vue/tests/`: `connectAndJoinTestConference()`, `getJitsiTestContext()`, `makeTrack()`.
   - Spy on `getMediaEngineInstance()` for track and constraint calls.
3. **Mocking Environment Variables**:
   - Use `vi.stubEnv('VITE_EVENTYAY_API_BASE', ...)` and `vi.unstubAllEnvs()` in `afterEach`.
4. **Vue Component Testing**:
   - Use `@vue/test-utils` with `mountWithApp()`.
   - Flush promises (`await flushPromises()`) after triggering reactive store actions or DOM events.

