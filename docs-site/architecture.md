# Architecture

```mermaid
flowchart TD
  subgraph eventyay [Eventyay Django app]
    Plugin[eventyay-loungemesh plugin]
    PluginAPI[/api/v1/loungemesh/token/]
  end
  subgraph loungemesh [LoungeMesh Vue SPA]
    subgraph vue [Vue 3 UI layer]
      Pages[Pages and components]
      Stores[Pinia UI state]
    end
    AccessGuard[useAccessGuard]
    Bridge[useEventyayBridge - postMessage]
    subgraph engine [Media layer]
      Composable[useMediaEngine]
      Worker[Proximity audio worker]
      AudioCtx[Web Audio GainNodes]
    end
    subgraph adapter [Adapter]
      MediaService[MediaService interface]
      JitsiAdapter[JitsiAdapter]
    end
  end
  subgraph media [Jitsi]
    LibJitsi[lib-jitsi-meet]
  end

  Plugin -->|opaque token in URL| AccessGuard
  AccessGuard -->|POST /token| PluginAPI
  PluginAPI -->|Jitsi JWT| AccessGuard
  AccessGuard -->|JWT| Composable
  Pages --> Stores
  Pages --> Composable
  Pages --> Bridge
  Composable --> MediaService
  MediaService --> JitsiAdapter
  JitsiAdapter --> LibJitsi
  Composable --> Worker
  JitsiAdapter --> AudioCtx
  Bridge <-->|postMessage| Plugin
```

## Principles

1. **No iframe API** — `lib-jitsi-meet` exposes raw tracks for proximity volume and custom avatars.
2. **Adapter boundary** — Vue code never imports Jitsi directly; only `JitsiAdapter` does.
3. **Pinia for UI state** — connection and conference stores hold reactive UI data; lifecycle lives in `useMediaEngine`.
4. **Performance** — route-level code splitting, proximity math in a Web Worker, `GainNode` ramps for smooth audio, `shallowReactive` users map, composite `:key` on remote users to limit re-renders.
5. **Access control** — gated behind Eventyay JWT when `VITE_EVENTYAY_API_BASE` is set; open mode for self-hosted deployments.
6. **Iframe embedding** — Eventyay embeds LoungeMesh with a `postMessage` bridge; "Open in new tab" is the primary UX. Frame-ancestors CSP is configurable at Docker runtime.

## Key modules

| Path | Role |
|------|------|
| `src-vue/services/MediaService.ts` | Backend-agnostic media interface |
| `src-vue/services/JitsiAdapter.ts` | Jitsi implementation + Web Audio routing + JWT re-auth |
| `src-vue/composables/useMediaEngine.ts` | Singleton composable, store sync, token refresh wiring |
| `src-vue/composables/useAccessGuard.ts` | Eventyay token exchange, sessionStorage, JWT access control |
| `src-vue/composables/useEvenytayBridge.ts` | iframe ↔ Eventyay postMessage bridge |
| `src-vue/workers/proximityAudio.worker.ts` | Off-main-thread volume calculation |
| `src-vue/pages/JoinPage.vue` | Eventyay entry point (`/join/:id?token=`) |
| `src-vue/pages/AccessDeniedPage.vue` | Shown when token is missing or invalid |

## Eventyay integration flow

```
User clicks lounge icon in Eventyay
  ↓
eventyay-loungemesh plugin issues opaque token
  ↓
Redirect → /join/<jitsiRoom>?token=<opaque>
  ↓
useAccessGuard: POST token → Eventyay API
  ↓
Jitsi JWT returned, stored in sessionStorage
  ↓
Redirect → /session/<jitsiRoom>
  ↓
useMediaEngine.connect(jwt) → JitsiAdapter → lib-jitsi-meet
  ↓
On AUTHENTICATION_REQUIRED → token refresh → reconnect
```
