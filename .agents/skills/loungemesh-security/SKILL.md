---
name: loungemesh-security
description: >-
  Security guidelines for LoungeMesh, covering credential sanitization, joinPin protection,
  role validation, AES-256 token encryption, and Nginx reverse proxy protection.
---

# LoungeMesh Security Skill

This skill enforces security best practices across the LoungeMesh codebase. Use this skill when modifying authentication, room access control, API serialization, or external integrations.

---

## 1. Credential & PIN Protection

### Room Access PIN (`joinPin`)
- A room may be configured with a `joinPin` stored in `MeetingConfig`.
- **CRITICAL**: The `joinPin` must **NEVER** be leaked in API responses to unauthenticated users or serialized in public room config payloads.
- Always sanitize config objects using `sanitizeMeetingConfig` in `server/src/controllers/meetingController.ts`:

```ts
function sanitizeMeetingConfig(configs: any) {
  if (!configs) return null;
  return {
    lobbyEnabled: !!configs.lobbyEnabled,
    lobbyForm: configs.lobbyForm === 'details' ? 'details' : 'name',
    stagePromotionEnabled: configs.stagePromotionEnabled !== undefined ? configs.stagePromotionEnabled : true,
    allowParticipantRecording: !!configs.allowParticipantRecording,
    notesTemplate: configs.notesTemplate || '',
  };
}
```

- When caching configs in Redis under `meeting:config:<roomName>`, only store the sanitized payload.

---

## 2. Role Verification & Authorization

- **Deriving Meeting Existence**:
  In `src-vue/stores/sessionFeaturesStore.ts`, derive `meetingExists` directly from `data.role.hostId` (`this.meetingExists = !!data.role.hostId`). Do not derive it from `data.config`, as a meeting may exist before its `MeetingConfig` record is created.
- **Action Guarding**:
  Protected actions (updating room settings, changing lobby admission, kicking attendees) must verify that `role === 'host'` or `role === 'moderator'`.
- **Email-mapped host**:
  The host is the meeting owner's email. Do not grant host because someone joined a link first. Moderator and guest emails are the invite lists. Missing or unlisted emails are attendees and stay in the lobby, which is on by default.
- **Feature revoke**: Room-wide tools are the host's switch. A moderator can revoke or restore one person, not change the room-wide switch. Apply an access or config command only from the host, a moderator grant, a moderator email, or the matching host email. Ignore a command from anyone else.
- **Lobby media**: Until a person is admitted, do not publish their camera or microphone, and do not play or show their tracks to people already in the room. The client treats the lobby as on until room config says otherwise.

---

## 3. Token & Secret Encryption

- **Google OAuth Tokens**:
  Stored in `User.googleToken` encrypted using AES-256-GCM with the 32-byte `ENCRYPTION_KEY`.
- **Session Tokens**:
  Signed with `JWT_SECRET` and transmitted via HTTP-only secure cookies or Authorization headers.

---

## 4. Nginx & Reverse Proxy Guardrails

- **Client Real IP**:
  Ensure `set_real_ip_from` and `real_ip_header X-Forwarded-For` remain configured so rate limits track real client IP addresses.
- **CSP Frame Ancestors**:
  Controlled via `NGINX_ALLOW_IFRAME_FROM` to restrict iframe embedding exclusively to authorized Eventyay domains.
