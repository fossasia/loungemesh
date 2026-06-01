/**
 * postMessage bridge between LoungeMesh (iframe) and Eventyay (parent window).
 *
 * When LoungeMesh is embedded in the Eventyay video platform, this composable:
 *  - Announces itself to the parent so the parent can show a "participants: N" count.
 *  - Receives a new JWT from the parent when the current one is about to expire.
 *  - Notifies the parent when the local user joins / leaves.
 *
 * Security: messages are only accepted from origins listed in VITE_ALLOW_IFRAME_FROM.
 * When not in an iframe (window === window.parent) the bridge is a no-op.
 */
import { onMounted, onUnmounted } from 'vue';

export type BridgeMessage =
  | { source: 'loungemesh'; type: 'ready' }
  | { source: 'loungemesh'; type: 'participant_joined'; count: number }
  | { source: 'loungemesh'; type: 'participant_left'; count: number }
  | { source: 'loungemesh'; type: 'token_expired'; opaqueToken: string }
  | { source: 'eventyay'; type: 'loungemesh:new_token'; jwt: string };

function getAllowedOrigins(): string[] {
  const raw = (import.meta.env.VITE_ALLOW_IFRAME_FROM as string | undefined)?.trim() ?? '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function isInIframe(): boolean {
  return window.parent !== window;
}

function postToParent(msg: BridgeMessage): void {
  if (!isInIframe()) return;
  const origins = getAllowedOrigins();
  if (origins.length === 0) return;
  for (const origin of origins) {
    try {
      window.parent.postMessage(msg, origin);
    } catch {
      /* cross-origin window may not be accessible */
    }
  }
}

/** Global JWT refresh callback — set by useMediaEngine when wiring onTokenExpired. */
let _jwtRefreshCallback: ((jwt: string) => void) | null = null;

export function setJwtRefreshCallback(fn: (jwt: string) => void): void {
  _jwtRefreshCallback = fn;
}

export function resetJwtRefreshCallback(): void {
  _jwtRefreshCallback = null;
}

export function useEventyayBridge() {
  const inIframe = isInIframe();

  function announce(): void {
    postToParent({ source: 'loungemesh', type: 'ready' });
  }

  function notifyJoined(count: number): void {
    postToParent({ source: 'loungemesh', type: 'participant_joined', count });
  }

  function notifyLeft(count: number): void {
    postToParent({ source: 'loungemesh', type: 'participant_left', count });
  }

  async function handleMessage(e: MessageEvent): Promise<void> {
    const allowed = getAllowedOrigins();
    if (allowed.length > 0 && !allowed.includes(e.origin)) return;
    if (!e.data || e.data.source !== 'eventyay') return;

    if (e.data.type === 'loungemesh:new_token') {
      const jwt = e.data.jwt as string;
      if (jwt && _jwtRefreshCallback) {
        _jwtRefreshCallback(jwt);
      }
    }
  }

  onMounted(() => {
    if (!inIframe) return;
    window.addEventListener('message', handleMessage);
    announce();
  });

  onUnmounted(() => {
    if (!inIframe) return;
    window.removeEventListener('message', handleMessage);
  });

  return { inIframe, announce, notifyJoined, notifyLeft, postToParent };
}
