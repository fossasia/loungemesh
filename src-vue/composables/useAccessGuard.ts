/**
 * Access guard for LoungeMesh sessions.
 *
 * Flow:
 *   1. Eventyay embeds or redirects user to /join/<jitsiRoom>?grant=<signed_grant>
 *   2. This composable sends the grant to LoungeMesh's exchange endpoint:
 *      POST /api/integration/exchange { grant }
 *   3. LoungeMesh verifies the grant signature, checks allow-list and capacity,
 *      sets the session cookie, and returns the role, capabilities, and Jitsi JWT.
 *   4. For backward compatibility, legacy ?token=<opaque> is supported via
 *      VITE_EVENTYAY_JWT_ENDPOINT if configured.
 */
import { ref, readonly } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';

export type AccessState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'granted';
      jwt: string | null;
      displayName: string;
      jitsiRoom: string;
      role?: string;
      capabilities?: string[];
    }
  | { status: 'denied'; reason: string };

const SESSION_KEY = 'loungemesh:access';

export interface StoredAccess {
  jwt: string | null;
  displayName: string;
  jitsiRoom: string;
  role?: string;
  capabilities?: string[];
  expiresAt: string;
  opaqueToken?: string;
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

/** Refresh JWT using session claims or legacy endpoint */
export async function refreshJwt(): Promise<string | null> {
  const stored = getStoredAccess();
  if (!stored) return null;

  // Try integration session first
  try {
    const res = await fetch('/api/integration/session');
    if (res.ok) {
      const data = await res.json();
      if (data.jwt) {
        storeAccess({ ...stored, jwt: data.jwt });
        return data.jwt;
      }
    }
  } catch {
    /* ignore */
  }

  // Legacy fallback
  if (stored.opaqueToken) {
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
      /* ignore */
    }
  }
  return null;
}

export function useAccessGuard() {
  const state = ref<AccessState>({ status: 'idle' });
  const route = useRoute();

  async function check(jitsiRoom: string, userPin?: string): Promise<AccessState> {
    state.value = { status: 'loading' };

    // Check sessionStorage first
    const stored = getStoredAccess();
    if (stored && stored.jitsiRoom === jitsiRoom) {
      if (stored.role && stored.capabilities) {
        useSessionFeaturesStore().setIntegrationAccess(stored.role, stored.capabilities);
      }
      const granted: AccessState = {
        status: 'granted',
        jwt: stored.jwt,
        displayName: stored.displayName,
        jitsiRoom,
        role: stored.role,
        capabilities: stored.capabilities,
      };
      state.value = granted;
      return granted;
    }

    const grant = String(route.query.grant ?? '').trim();
    const token = String(route.query.token ?? '').trim();
    const pin = userPin?.trim() || String(route.query.pin ?? '').trim();

    // 1. Signed Grant flow (modern Eventyay integration)
    if (grant) {
      try {
        const res = await fetch('/api/integration/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant, pin: pin || undefined }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const denied: AccessState = {
            status: 'denied',
            reason: data.error || (res.status === 409 ? 'room_full' : 'not_allowed'),
          };
          state.value = denied;
          return denied;
        }

        const jwt: string | null = data.jwt || null;
        const displayName: string = data.display_name || '';
        const role: string = data.role || 'attendee';
        const capabilities: string[] = data.capabilities || [];
        const expiresAt: string = data.expires_at || new Date(Date.now() + 7200_000).toISOString();

        storeAccess({ jwt, displayName, jitsiRoom, role, capabilities, expiresAt });
        useSessionFeaturesStore().setIntegrationAccess(role, capabilities);

        const granted: AccessState = {
          status: 'granted',
          jwt,
          displayName,
          jitsiRoom,
          role,
          capabilities,
        };
        state.value = granted;
        return granted;
      } catch {
        const denied: AccessState = { status: 'denied', reason: 'network_error' };
        state.value = denied;
        return denied;
      }
    }

    // 2. Legacy token flow (backwards compatibility)
    if (token) {
      const endpoint = (import.meta.env.VITE_EVENTYAY_JWT_ENDPOINT as string | undefined)?.trim();
      if (!endpoint) {
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

    // 3. Open mode fallback when not gated
    const apiBase = (import.meta.env.VITE_EVENTYAY_API_BASE as string | undefined)?.trim();
    if (!apiBase && !token && !grant) {
      const granted: AccessState = { status: 'granted', jwt: null, displayName: '', jitsiRoom };
      state.value = granted;
      return granted;
    }

    const denied: AccessState = { status: 'denied', reason: 'no_token' };
    state.value = denied;
    return denied;
  }

  return { state: readonly(state), check };
}
