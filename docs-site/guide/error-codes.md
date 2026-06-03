# Session error codes

End users see short messages with a code such as `LM-E001`. Raw Jitsi/XMPP text stays in the browser console when `VITE_MEDIA_DEBUG=true` or in server logs — it is not shown in the UI.

| Code | User message | Typical cause |
|------|----------------|---------------|
| **LM-E001** | Couldn't connect to the session. | Jitsi XMPP/BOSH/WebSocket unreachable, wrong `PUBLIC_URL`, or firewall blocking the stack |
| **LM-E002** | The connection was lost. | Connection dropped after it was established |
| **LM-E003** | Couldn't join this session. | Room join failed before the conference became active |
| **LM-E004** | This session is unavailable right now. | Jicofo/JVB not ready, focus error, or bridge rejected the room |
| **LM-E005** | Sign-in expired or not allowed. | Missing, expired, or invalid JWT for the Jitsi secure domain |
| **LM-E006** | Check your network connection. | Browser offline or network failure reaching LoungeMesh/Jitsi |
| **LM-E007** | The session isn't ready yet. | Join attempted before the Jitsi connection finished connecting |
| **LM-E008** | Something went wrong. | Unclassified failure — check logs and retry |

## For operators

1. Note the code the user reports (e.g. `LM-E003`).
2. Match it in the table above.
3. Enable media debug locally: `VITE_MEDIA_DEBUG=true` in `.env`, rebuild, reproduce, and inspect the console for the underlying Jitsi detail (mapped in `classifySessionError` in `src-vue/services/sessionErrorCodes.ts`).

Codes are assigned in `normalizeSessionError()` when errors reach Pinia stores or when `ErrorHandler` formats them for display.
