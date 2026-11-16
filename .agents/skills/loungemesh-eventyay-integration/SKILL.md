---
name: loungemesh-eventyay-integration
description: >-
  Integration guide for Eventyay and LoungeMesh, covering opaque token exchange, Jitsi JWT lifecycle,
  postMessage iframe bridge, capability permissions, and integration testing.
---

# LoungeMesh Eventyay Integration Skill

This skill explains how LoungeMesh integrates with Eventyay via the `eventyay-loungemesh` Django plugin. Use this skill when working on access guards, ticket-gated room entry, iframe embedding, or JWT authentication renewal.

---

## 1. Integration Architecture

LoungeMesh is deployed as an independent SPA service and connects to Eventyay through two primary channels:

1. **Token Authentication Bridge**:
   - Eventyay acts as the identity provider for ticketed events.
   - Ticket holders entering a lounge receive an opaque one-time token.
   - LoungeMesh exchanges this token for a cryptographically signed Jitsi JWT.
2. **Iframe Embed `postMessage` Bridge**:
   - Eventyay embeds LoungeMesh in event schedule pages.
   - An origin-validated `postMessage` bridge communicates user actions, full-screen expansion, and session events.

---

## 2. Token Exchange & JWT Lifecycle

```
User clicks "Enter Lounge" in Eventyay event portal
  ↓
eventyay-loungemesh issues an opaque token (TTL: 2 hours)
  ↓
Redirect to: /join/<roomName>?token=<opaqueToken>&event=<eventSlug>&room=<roomSlug>
  ↓
useAccessGuard (src-vue/composables/useAccessGuard.ts):
  POST <VITE_EVENTYAY_JWT_ENDPOINT> with body { token: opaqueToken }
  ↓
Eventyay returns signed Jitsi JWT + user capabilities + display name + avatar
  ↓
JWT stored in browser sessionStorage
  ↓
Redirect to /session/<roomName>
  ↓
JitsiAdapter connects to Jitsi Videobridge passing JWT credentials
```

### Automatic Re-Authentication on Expiry
When a Jitsi JWT expires during a live conference:
1. `lib-jitsi-meet` emits `JitsiConferenceEvents.CONFERENCE_FAILED` with error `AUTHENTICATION_REQUIRED`.
2. `JitsiAdapter` catches the event and invokes the refresh hook wired by `useMediaEngine`.
3. `useAccessGuard` calls the Eventyay token refresh endpoint.
4. The fresh JWT is injected into the active session without requiring a full page reload or interrupting the user's spatial position.

---

## 3. Eventyay Capabilities & Store Integration

When entering via Eventyay, `sessionFeaturesStore` initializes:
- `eventyayMeet = true`
- `eventyayRole = 'host' | 'moderator' | 'reviewer' | 'attendee'`
- `capabilities = ['moderate', 'notes', 'whiteboard', 'poll_manage']`

### Permission Logic in `sessionFeaturesStore.ts`
- **Host / Moderator**:
  - `isModerator` evaluates `eventyayRole === 'moderator' || eventyayRole === 'reviewer'`.
  - Ticketed attendee capabilities (e.g. `notes`, `whiteboard`, `poll_manage`) are evaluated dynamically against `capabilities` array.
- **Polls**:
  - Attendees in Eventyay can request or access polls (`this.canUsePoll || this.eventyayMeet`).
  - Management requires `capabilities.includes('poll_manage')` or `capabilities.includes('moderate')`.

---

## 4. Iframe Embedding & Origin Security

Configured via environment variables:
- `NGINX_ALLOW_IFRAME_FROM`: Configures `Content-Security-Policy: frame-ancestors` header at Docker runtime:
  ```env
  NGINX_ALLOW_IFRAME_FROM="https://eventyay.com https://video.eventyay.com"
  ```
- `VITE_ALLOW_IFRAME_FROM`: Whitelisted parent origins for `src-vue/composables/useEventyayBridge.ts`:
  ```env
  VITE_ALLOW_IFRAME_FROM="https://eventyay.com,https://video.eventyay.com"
  ```
- Messages received from origins not in this whitelist are discarded immediately.

---

## 5. Testing Guidelines

When writing unit or integration tests for Eventyay flows:
- Stub environment variables using Vitest:
  ```ts
  vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
  vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.test/api/v1/loungemesh/token/');
  ```
- Mock `fetch` responses matching the Eventyay token endpoint:
  ```ts
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      jwt: 'mock-jitsi-jwt',
      user: { name: 'Alice', avatar: 'https://example.com/avatar.png' },
      role: 'attendee',
      capabilities: ['notes', 'whiteboard'],
    }),
  });
  ```
- Verify both success redirects to `/session/<roomName>` and failure handling rendering the inline access denied state.
- Maintain 100% test coverage across `src-vue/composables/useAccessGuard.ts` and `src-vue/composables/useEventyayBridge.ts`.
