import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { routes } from '@/router/routes';
import {
  clearStoredAccess,
  getStoredJwt,
  getStoredOpaqueToken,
  refreshJwt,
  useAccessGuard,
  type StoredAccess,
} from './useAccessGuard';

async function withRouter<T>(path: string, run: (guard: ReturnType<typeof useAccessGuard>) => Promise<T>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();

  let guard!: ReturnType<typeof useAccessGuard>;
  const Comp = defineComponent({
    setup() {
      guard = useAccessGuard();
      return () => null;
    },
  });

  const app = createApp(Comp);
  app.use(pinia);
  app.use(router);
  const el = document.createElement('div');
  document.body.appendChild(el);
  app.mount(el);
  await nextTick();

  try {
    return await run(guard);
  } finally {
    app.unmount();
    el.remove();
  }
}

describe('useAccessGuard — sessionStorage helpers', () => {
  beforeEach(() => clearStoredAccess());

  it('getStoredJwt returns null when nothing is stored', () => {
    expect(getStoredJwt()).toBeNull();
  });

  it('getStoredJwt returns null for expired entries', () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'old-jwt',
        displayName: 'Bob',
        jitsiRoom: 'r1',
        opaqueToken: 'tok',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    expect(getStoredJwt()).toBeNull();
  });

  it('getStoredOpaqueToken returns null when opaque token is missing', () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'j',
        displayName: 'A',
        jitsiRoom: 'r',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    expect(getStoredOpaqueToken()).toBeNull();
  });

  it('getStoredOpaqueToken returns opaque token when stored', () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'j',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque-1',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    expect(getStoredOpaqueToken()).toBe('opaque-1');
  });

  it('getStoredJwt returns stored JWT when not expired', () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'valid-jwt',
        displayName: 'Carol',
        jitsiRoom: 'r2',
        opaqueToken: 'tok2',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    expect(getStoredJwt()).toBe('valid-jwt');
  });
});

describe('refreshJwt', () => {
  beforeEach(() => {
    clearStoredAccess();
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', '');
  });

  it('returns null when no endpoint is set', async () => {
    expect(await refreshJwt()).toBeNull();
  });

  it('returns null when endpoint is unset but opaque token exists', async () => {
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', '');
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'j',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque-1',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    expect(await refreshJwt()).toBeNull();
  });

  it('returns null when no stored token exists', async () => {
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://example.com/api/v1/loungemesh/token/');
    expect(await refreshJwt()).toBeNull();
  });

  it('returns null when refresh response has no jwt', async () => {
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://example.com/api/v1/loungemesh/token/');
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'j',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque-1',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await refreshJwt()).toBeNull();
  });

  it('returns null when refresh network call fails', async () => {
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://example.com/api/v1/loungemesh/token/');
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'j',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque-1',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await refreshJwt()).toBeNull();
  });

  it('refreshes jwt from API', async () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'old',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jwt: 'fresh', expires_at: new Date(Date.now() + 3600_000).toISOString() }),
      }),
    );
    expect(await refreshJwt()).toBe('fresh');
  });

  it('refreshes jwt via legacy endpoint when integration session fails', async () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'old',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/integration/session') {
          return { ok: false, status: 404 };
        }
        return {
          ok: true,
          json: async () => ({ jwt: 'legacy-fresh', expires_at: '2026-10-10T23:00:00Z' }),
        };
      }),
    );
    expect(await refreshJwt()).toBe('legacy-fresh');
  });

  it('refreshes jwt via legacy endpoint with fallback expiresAt', async () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'old',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
    );
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/integration/session') {
          return { ok: false, status: 404 };
        }
        return {
          ok: true,
          json: async () => ({ jwt: 'legacy-fallback-expires' }),
        };
      }),
    );
    expect(await refreshJwt()).toBe('legacy-fallback-expires');
  });

  it('returns null when stored access JSON is invalid', async () => {
    sessionStorage.setItem('loungemesh:access', 'not-json');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    expect(await refreshJwt()).toBeNull();
  });

  it('returns null when refresh HTTP response is not ok', async () => {
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'j',
        displayName: 'A',
        jitsiRoom: 'r',
        opaqueToken: 'opaque',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await refreshJwt()).toBeNull();
  });
});

describe('useAccessGuard.check', () => {
  beforeEach(() => {
    clearStoredAccess();
    vi.restoreAllMocks();
  });

  it('grants access in open mode', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', '');
    const result = await withRouter('/join/room-a', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
  });

  it('denies when token is missing', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    const result = await withRouter('/join/room-a', (guard) => guard.check('room-a'));
    expect(result).toEqual({ status: 'denied', reason: 'no_token' });
  });

  it('ignores sessionStorage when the stored room differs', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'jwt',
        displayName: 'Alice',
        jitsiRoom: 'other-room',
        opaqueToken: 'tok',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    const result = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(result.status).toBe('denied');
  });

  it('grants from sessionStorage when room matches', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    const stored: StoredAccess = {
      jwt: 'jwt',
      displayName: 'Alice',
      jitsiRoom: 'room-a',
      opaqueToken: 'tok',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
    sessionStorage.setItem('loungemesh:access', JSON.stringify(stored));
    const result = await withRouter('/join/room-a?token=ignored', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
    if (result.status === 'granted') expect(result.jwt).toBe('jwt');
  });

  it('exchanges token via API', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jwt: 'new-jwt',
          display_name: 'Bob',
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        }),
      }),
    );
    const result = await withRouter('/join/room-a?token=opaque', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
  });

  it('grants with empty optional fields from API', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    );
    const result = await withRouter('/join/room-a?token=opaque', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.jwt).toBeNull();
      expect(result.displayName).toBe('');
    }
  });

  it('uses forbidden fallback when 403 body is not JSON', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => {
          throw new Error('invalid json');
        },
      }),
    );
    const result = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(result).toEqual({ status: 'denied', reason: 'forbidden' });
  });

  it('handles forbidden, server error, and network failure', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'token_expired' }) }),
    );
    let r = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(r.status === 'denied' && r.reason).toBe('token_expired');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    r = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(r.status === 'denied' && r.reason).toBe('server_error');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    r = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(r.status === 'denied' && r.reason).toBe('network_error');
  });

  it('grants when API base set but JWT endpoint missing', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', '');
    const result = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
  });

  it('still grants when sessionStorage setItem throws', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.com/api/v1/loungemesh/token/');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jwt: 'j', display_name: 'A', expires_at: new Date(Date.now() + 1000).toISOString() }),
      }),
    );
    const result = await withRouter('/join/room-a?token=t', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
  });

  it('exchanges signed grant via integration API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jwt: 'grant-jwt',
          display_name: 'Grant User',
          role: 'speaker',
          capabilities: ['screen_share'],
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        }),
      }),
    );
    const result = await withRouter('/join/room-a?grant=signed-grant-token', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.jwt).toBe('grant-jwt');
      expect(result.displayName).toBe('Grant User');
      expect(result.role).toBe('speaker');
      expect(result.capabilities).toEqual(['screen_share']);
    }
  });

  it('exchanges signed grant with explicit userPin', async () => {
    let capturedBody = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        capturedBody = String(init?.body ?? '');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            jwt: 'grant-jwt',
            display_name: 'Grant User',
            role: 'speaker',
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          }),
        });
      }),
    );
    const result = await withRouter('/join/room-a?grant=signed-grant-token', (guard) => guard.check('room-a', '9876'));
    expect(result.status).toBe('granted');
    expect(JSON.parse(capturedBody).pin).toBe('9876');
  });

  it('exchanges signed grant with pin from route query', async () => {
    let capturedBody = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        capturedBody = String(init?.body ?? '');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            jwt: 'grant-jwt',
            display_name: 'Grant User',
            role: 'speaker',
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          }),
        });
      }),
    );
    const result = await withRouter('/join/room-a?grant=signed-grant-token&pin=5432', (guard) => guard.check('room-a'));
    expect(result.status).toBe('granted');
    expect(JSON.parse(capturedBody).pin).toBe('5432');
  });

  it('handles signed grant failure with room full (409) and error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'room_full' }),
      }),
    );
    let result = await withRouter('/join/room-a?grant=full-grant', (guard) => guard.check('room-a'));
    expect(result).toEqual({ status: 'denied', reason: 'room_full' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'invalid_grant' }),
      }),
    );
    result = await withRouter('/join/room-a?grant=bad-grant', (guard) => guard.check('room-a'));
    expect(result).toEqual({ status: 'denied', reason: 'invalid_grant' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection refused')),
    );
    result = await withRouter('/join/room-a?grant=fail-grant', (guard) => guard.check('room-a'));
    expect(result).toEqual({ status: 'denied', reason: 'network_error' });
  });

  it('restores role and capabilities from sessionStorage when room matches', async () => {
    const stored: StoredAccess = {
      jwt: 'stored-jwt',
      displayName: 'Stored User',
      jitsiRoom: 'room-b',
      role: 'moderator',
      capabilities: ['moderate', 'notes'],
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
    sessionStorage.setItem('loungemesh:access', JSON.stringify(stored));
    const result = await withRouter('/join/room-b', (guard) => guard.check('room-b'));
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.role).toBe('moderator');
      expect(result.capabilities).toEqual(['moderate', 'notes']);
    }
  });

  it('returns null when stored has no opaqueToken and integration session fails', async () => {
    sessionStorage.setItem(
      'loungemesh:access',
      JSON.stringify({
        jwt: 'old',
        displayName: 'A',
        jitsiRoom: 'r',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await refreshJwt()).toBeNull();
  });

  it('exchanges signed grant with default fallbacks when fields are empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    );
    const result = await withRouter('/join/room-c?grant=minimal-grant', (guard) => guard.check('room-c'));
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.jwt).toBeNull();
      expect(result.displayName).toBe('');
      expect(result.role).toBe('attendee');
      expect(result.capabilities).toEqual([]);
    }
  });

  it('handles signed grant failure with non-json body falling back to not_allowed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => {
          throw new Error('invalid json');
        },
      }),
    );
    const result = await withRouter('/join/room-c?grant=non-json-grant', (guard) => guard.check('room-c'));
    expect(result).toEqual({ status: 'denied', reason: 'not_allowed' });
  });

  it('handles signed grant 409 without body error defaulting to room_full', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({}),
      }),
    );
    const result = await withRouter('/join/room-c?grant=full-no-msg', (guard) => guard.check('room-c'));
    expect(result).toEqual({ status: 'denied', reason: 'room_full' });
  });
});
