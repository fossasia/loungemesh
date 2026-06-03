# Implementation status

This page is a living snapshot of what is built, what is in progress, and what is planned.

## What is working

### LoungeMesh SPA

| Area | Status |
|------|--------|
| Vue 3 + TypeScript + Vite + Pinia scaffold | ✅ Complete |
| `MediaService` abstraction interface | ✅ Complete |
| `JitsiAdapter` (lib-jitsi-meet, no iframe) | ✅ Complete |
| `useMediaEngine` composable (singleton, store sync) | ✅ Complete |
| Proximity audio Web Worker | ✅ Complete |
| Web Audio API GainNode per participant | ✅ Complete |
| `useAccessGuard` (Eventyay JWT exchange) | ✅ Complete |
| `useEvenytayBridge` (postMessage iframe bridge) | ✅ Complete |
| `JoinPage` (opaque token → JWT flow) | ✅ Complete |
| `AccessDeniedPage` (all error reasons) | ✅ Complete |
| Room canvas with pan/zoom (`PanWrapper`) | ✅ Complete |
| Chat panel | ✅ Complete |
| Stage / screenshare support | ✅ Complete |
| Mute/unmute controls | ✅ Complete |
| Session prefix (`secureConferenceName`) | ✅ Complete |
| `sessionConnectionWatch` lifecycle | ✅ Complete |
| 100% Vitest coverage (lines/statements/functions/branches) | ✅ 268 tests |
| Playwright e2e smoke tests (12) | ✅ Complete |
| TypeDoc API reference generation | ✅ Complete |
| VitePress docs site (this site) | ✅ Complete |
| GitHub Actions CI (typecheck + tests + build + docs) | ✅ Complete |
| GitHub Actions docs deploy (GitHub Pages) | ✅ Complete |
| Docker multi-stage build (Node → nginx) | ✅ Complete |
| Docker Compose with full Jitsi stack | ✅ Complete |
| nginx with gzip_static + runtime frame-ancestors CSP | ✅ Complete |
| Build-time gzip + brotli compression (`vite-plugin-compression2`) | ✅ Complete |
| Web app manifest + mobile meta | ✅ Complete |
| Blue theme (`#e4eaff` background, `#4f6ef7` accent) | ✅ Complete |

### eventyay-loungemesh plugin

| Area | Status |
|------|--------|
| `LoungeMeshRoom` model | ✅ Complete |
| `LoungeMeshAccessToken` model | ✅ Complete |
| JWT issuance (`issue_jitsi_jwt`, `verify_loungemesh_token`) | ✅ Complete |
| `LoungeMeshIframeView` (embed page with "Open in new tab") | ✅ Complete |
| `LoungeMeshTokenAPIView` (opaque → JWT exchange) | ✅ Complete |
| `LoungeMeshTokenRefreshView` (JWT renewal) | ✅ Complete |
| Organizer room list view | ✅ Complete |
| Room create/edit control views | ✅ Complete |
| `allow_guests` access control enforcement | ✅ Complete |
| Organizer nav signal | ✅ Complete |
| Django admin for both models | ✅ Complete |
| Database migration (`0001_initial`) | ✅ Complete |
| `PretixPluginMeta` entry point (both pretix + eventyay keys) | ✅ Fixed |
| Plugin logo SVG | ✅ Added |
| postMessage bridge in embed template | ✅ Complete |
| 20 self-contained pytest tests | ✅ Complete |
| GitHub Actions CI (style + tests) | ✅ Complete |

---

## What is in progress / planned

### LoungeMesh SPA

| Area | Notes |
|------|-------|
| Service worker / offline support | Manifest is wired; SW not yet registered |
| Video quality adaptation | `channelLastN: 3` is set; dynamic UI not wired |
| `requestIdleCallback` for idle position updates | Architecture ready, not implemented |
| Virtual scrolling for large participant lists | Planned for >20 participants |
| Adaptive simulcast controls per participant count | Depends on JVB config |

### eventyay-loungemesh plugin

| Area | Notes |
|------|-------|
| Ticket / order validation | Model has `order_code`; view does not yet enforce ticket check |
| Locale / translation strings | `.po` headers exist; strings not yet translated |
| Event-level LoungeMesh URL setting in Eventyay admin | Plugin setting not yet registered |
| Room deletion view | Not yet implemented (manual admin only) |

---

## Architecture overview

See [Architecture](../architecture.md) for the full layered diagram and design decisions.

## Next milestones

1. **Service worker** — register and cache critical shell assets for fast repeat loads.
2. **Ticket gating** — check Eventyay order status before issuing access tokens.
3. **Room settings** — register `loungemesh_url` and `loungemesh_jitsi_*` as Eventyay event settings.
4. **Quality UI** — surface participant count and automatically adjust `channelLastN`.
5. **Translation** — complete German and other locale strings.
