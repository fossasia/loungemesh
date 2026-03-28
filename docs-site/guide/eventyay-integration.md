# Eventyay integration

Flowspace is designed as an external application that integrates with Eventyay:

- **Eventyay (control plane):** authentication, access control, display names, room configuration
- **Flowspace (interaction layer):** spatial UI, proximity audio, presence
- **Jitsi (media plane):** WebRTC transport

## Identity

Flowspace does not manage user accounts. Eventyay provides the display name; pass it when joining:

```typescript
await joinRoom(roomId, eventyayDisplayName, conferenceOptions);
```

## JWT (secure Jitsi)

For self-hosted Jitsi with JWT:

1. Set `VITE_EVENTYAY_JWT_ENDPOINT` to your token API.
2. The `JitsiAdapter` passes the token to `JitsiConnection(appId, token, options)`.
3. Implement token refresh via `engine.onTokenExpired(refreshFn)`.

## Wallpapers

When `VITE_EVENTYAY_API_BASE` is set, room backgrounds can load from the Eventyay API.
