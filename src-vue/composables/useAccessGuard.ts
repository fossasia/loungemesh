/**
 * Eventyay access guard for Flowspace.
 *
 * Flow:
 *   1. Eventyay plugin issues an opaque token and redirects the user to
 *      /join/<jitsiRoom>?token=<opaque>&event=<slug>&room=<slug>
 *   2. This composable exchanges the opaque token for a signed Jitsi JWT
 *      by calling VITE_EVENTYAY_JWT_ENDPOINT (the eventyay-flowspace plugin API).
 *   3. The resolved Jitsi JWT is stored in sessionStorage so it survives
 *      the in-page navigation from /join → /session.
 *   4. When VITE_EVENTYAY_API_BASE is not set, the app is in open mode
 *      and no token is required (useful for self-hosted / dev deployments).
 */
import { ref, readonly } from 'vue';
import { useRoute } from 'vue-router';

export type AccessState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'granted'; jwt: string | null; displayName: string; jitsiRoom: string }
  | { status: 'denied'; reason: string };

const SESSION_KEY = 'flowspace:access';

export interface StoredAccess {
  jwt: string | null;
  displayName: string;
  jitsiRoom: string;
  /** Opaque token for JWT refresh calls */
  opaqueToken: string;
  expiresAt: string;
}

function getStoredAccess(): StoredAccess | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: StoredAccess = JSON.parse(raw);
    if (new Date(parsed.expiresAt) < new Date()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeAccess(data: StoredAccess): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* storage full or private mode */
  }
}

export function clearStoredAccess(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getStoredJwt(): string | null {
  return getStoredAccess()?.jwt ?? null;
}

export function getStoredOpaqueToken(): string | null {
  return getStoredAccess()?.opaqueToken ?? null;
}

/**
 * Fetch a fresh Jitsi JWT from the eventyay-flowspace token refresh endpoint.
 * Called by JitsiAdapter when the Jitsi conference emits AUTHENTICATION_REQUIRED.
 */
export async function refreshJwt(): Promise<string | null> {
  const stored = getStoredAccess();
  if (!stored?.opaqueToken) return null;

  const endpoint = (import.meta.env.VITE_EVENTYAY_JWT_ENDPOINT as string | undefined)?.trim();
  if (!endpoint) return null;

  try {
    const refreshUrl = endpoint.replace(/\/token\/?$/, '/token/refresh/');
    const res = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: stored.opaqueToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.jwt) {
      storeAccess({ ...stored, jwt: data.jwt, expiresAt: data.expires_at ?? stored.expiresAt });
      return data.jwt as string;
    }
  } catch {
    /* network error */
  }
  return null;
}

/**
 * Composable used on the /join route to gate entry.
 *
 * Usage:
 *   const guard = useAccessGuard();
 *   await guard.check(route.params.id, route.query);
 *   // then watch guard.state
 */
export function useAccessGuard() {
  const state = ref<AccessState>({ status: 'idle' });
  const route = useRoute();

  async function check(jitsiRoom: string): Promise<AccessState> {
    const apiBase = (import.meta.env.VITE_EVENTYAY_API_BASE as string | undefined)?.trim();

    // Open mode — no Eventyay restriction
    if (!apiBase) {
      const granted: AccessState = { status: 'granted', jwt: null, displayName: '', jitsiRoom };
      state.value = granted;
      return granted;
    }

    state.value = { status: 'loading' };

    // Check sessionStorage first (user may have navigated back)
    const stored = getStoredAccess();
    if (stored && stored.jitsiRoom === jitsiRoom) {
      const granted: AccessState = {
        status: 'granted',
        jwt: stored.jwt,
        displayName: stored.displayName,
        jitsiRoom,
      };
      state.value = granted;
      return granted;
    }

    const token = String(route.query.token ?? '').trim();
    if (!token) {
      const denied: AccessState = {
        status: 'denied',
        reason: 'no_token',
      };
      state.value = denied;
      return denied;
    }

    const endpoint = (import.meta.env.VITE_EVENTYAY_JWT_ENDPOINT as string | undefined)?.trim();
    if (!endpoint) {
      // JWT endpoint not configured — treat as open mode with opaque token
      const granted: AccessState = { status: 'granted', jwt: null, displayName: '', jitsiRoom };
      state.value = granted;
      return granted;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        const denied: AccessState = {
          status: 'denied',
          reason: (body as { error?: string }).error ?? 'forbidden',
        };
        state.value = denied;
        return denied;
      }

      if (!res.ok) {
        const denied: AccessState = { status: 'denied', reason: 'server_error' };
        state.value = denied;
        return denied;
      }

      const data = await res.json();
      const jwt: string | null = data.jwt || null;
      const displayName: string = data.display_name || '';
      const expiresAt: string = data.expires_at || new Date(Date.now() + 7200_000).toISOString();

      storeAccess({ jwt, displayName, jitsiRoom, opaqueToken: token, expiresAt });

      const granted: AccessState = { status: 'granted', jwt, displayName, jitsiRoom };
      state.value = granted;
      return granted;
    } catch {
      const denied: AccessState = { status: 'denied', reason: 'network_error' };
      state.value = denied;
      return denied;
    }
  }

  return { state: readonly(state), check };
}
