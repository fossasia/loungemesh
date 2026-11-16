import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, nextTick, createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { routes } from '@/router/routes';
import { useAccessGuard, clearStoredAccess } from './useAccessGuard';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { createPinia, setActivePinia } from 'pinia';

async function withRouter<T>(path: string, run: (guard: ReturnType<typeof useAccessGuard>) => Promise<T>) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();

  const pinia = createPinia();
  setActivePinia(pinia);

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

describe('useAccessGuard — signed grant flow', () => {
  beforeEach(() => {
    clearStoredAccess();
    vi.restoreAllMocks();
  });

  it('exchanges grant with server and stores role & capabilities', async () => {
    const fakeExchangeResponse = {
      status: 'granted',
      role: 'moderator',
      capabilities: ['moderate', 'notes'],
      display_name: 'Alice',
      jwt: 'mock-jwt-token',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeExchangeResponse,
      }),
    );

    const result = await withRouter('/join/room-abc?grant=valid-grant-token', (guard) =>
      guard.check('room-abc'),
    );

    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.role).toBe('moderator');
      expect(result.capabilities).toEqual(['moderate', 'notes']);
      expect(result.displayName).toBe('Alice');
      expect(result.jwt).toBe('mock-jwt-token');
    }

    const sessionStore = useSessionFeaturesStore();
    expect(sessionStore.eventyayMeet).toBe(true);
    expect(sessionStore.eventyayRole).toBe('moderator');
    expect(sessionStore.isModerator).toBe(true);
    expect(sessionStore.isHost).toBe(false);
    expect(sessionStore.canUseNotes).toBe(true);
  });

  it('handles room_full capacity denial', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'room_full', limit: 50 }),
      }),
    );

    const result = await withRouter('/join/room-abc?grant=full-room-grant', (guard) =>
      guard.check('room-abc'),
    );

    expect(result).toEqual({ status: 'denied', reason: 'room_full' });
  });

  it('handles not_allowed denial for unauthorized attendees', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'not_allowed' }),
      }),
    );

    const result = await withRouter('/join/room-abc?grant=unauthorized-grant', (guard) =>
      guard.check('room-abc'),
    );

    expect(result).toEqual({ status: 'denied', reason: 'not_allowed' });
  });
});
