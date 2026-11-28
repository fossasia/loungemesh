import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import HomePage from './HomePage.vue';

const meetingFactory = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1',
  title: 'Planning Call',
  roomName: 'planning-call',
  startTime: '2026-11-27T13:00:00.000Z',
  endTime: '2026-11-27T14:00:00.000Z',
  recurrence: 'NONE',
  hostId: 'host-1',
  guestEmails: [],
  ...overrides,
});

function signInAsHost() {
  const auth = useAuthStore();
  auth.loading = false;
  auth.user = { id: 'host-1', email: 'host@example.com', displayName: 'Host', avatarUrl: null };
  auth.isAuthenticated = true;
}

describe('HomePage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('releases local media on mount', async () => {
    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    const { wrapper } = await mountWithApp(HomePage, { route: '/' });
    expect(stopSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('mounts and submits username and session', async () => {
    const auth = useAuthStore();
    auth.loading = false;
    auth.isAuthenticated = false;

    const { wrapper, router } = await mountWithApp(HomePage, { route: '/' });
    expect(wrapper.text()).toContain('LoungeMesh');
    const push = vi.spyOn(router, 'push');
    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue('Alex');
    await inputs[1].setValue('my-room');
    await wrapper.find('form').trigger('submit');
    expect(useConferenceStore().displayName).toBe("Alex's Sphere");
    expect(push).toHaveBeenCalledWith('/session/my-room');
    wrapper.unmount();
  });

  it('shows the end date when a meeting has no start time', async () => {
    signInAsHost();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [meetingFactory({ startTime: null })],
      }),
    );
    try {
      const { wrapper } = await mountWithApp(HomePage, { route: '/' });
      await flushPromises();
      expect(wrapper.text()).toContain('Planning Call');
      expect(wrapper.find('.timeText').text()).toContain('Nov 27');
      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores a stale poll response that resolves after a newer one', async () => {
    vi.useFakeTimers();
    try {
      signInAsHost();
      const ended = meetingFactory({ id: 'ended', title: 'Ended Meeting' });
      const live = meetingFactory({ id: 'live', title: 'Live Meeting' });

      let resolveFirst!: (value: unknown) => void;
      let resolveSecond!: (value: unknown) => void;
      const firstFetch = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondFetch = new Promise((resolve) => {
        resolveSecond = resolve;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn()
          .mockImplementationOnce(() => firstFetch)
          .mockImplementationOnce(() => secondFetch),
      );

      const { wrapper } = await mountWithApp(HomePage, { route: '/' });
      // First fetch in flight; fire the 5s poll to start the second fetch.
      await vi.advanceTimersByTimeAsync(5000);
      resolveSecond({ ok: true, json: async () => [live] });
      await flushPromises();
      resolveFirst({ ok: true, json: async () => [ended, live] });
      await flushPromises();

      expect(wrapper.text()).toContain('Live Meeting');
      expect(wrapper.text()).not.toContain('Ended Meeting');
      wrapper.unmount();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('applies a slow first response instead of starving it', async () => {
    vi.useFakeTimers();
    try {
      signInAsHost();
      const first = meetingFactory({ id: 'first', title: 'First Meeting' });
      const second = meetingFactory({ id: 'second', title: 'Second Meeting' });

      let resolveFirst!: (value: unknown) => void;
      let resolveSecond!: (value: unknown) => void;
      const firstFetch = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondFetch = new Promise((resolve) => {
        resolveSecond = resolve;
      });
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(() => firstFetch)
        .mockImplementationOnce(() => secondFetch);
      vi.stubGlobal('fetch', fetchMock);

      const { wrapper } = await mountWithApp(HomePage, { route: '/' });
      // The 5s poll starts a second fetch while the first is still slow.
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // The slow first response still applies: nothing newer has applied yet.
      resolveFirst({ ok: true, json: async () => [first] });
      await flushPromises();
      expect(wrapper.text()).toContain('First Meeting');
      // The second response then replaces it, as the newest applied response.
      resolveSecond({ ok: true, json: async () => [second] });
      await flushPromises();
      expect(wrapper.text()).toContain('Second Meeting');
      expect(wrapper.text()).not.toContain('First Meeting');
      wrapper.unmount();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('does not refill the list when a fetch resolves after logout', async () => {
    signInAsHost();
    let resolveFetch!: (value: unknown) => void;
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        url === '/api/meetings/upcoming'
          ? pendingFetch
          : Promise.resolve({ ok: true, json: async () => [] }),
      ),
    );
    try {
      const { wrapper } = await mountWithApp(HomePage, { route: '/' });
      await flushPromises();
      // Log out while the fetch is still in flight.
      const auth = useAuthStore();
      auth.isAuthenticated = false;
      await flushPromises();
      expect(wrapper.text()).not.toContain('Planning Call');
      resolveFetch({ ok: true, json: async () => [meetingFactory()] });
      await flushPromises();
      expect(wrapper.text()).not.toContain('Planning Call');
      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps polling after a failed fetch', async () => {
    vi.useFakeTimers();
    try {
      signInAsHost();
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue({ ok: true, json: async () => [meetingFactory()] });
      vi.stubGlobal('fetch', fetchMock);

      const { wrapper } = await mountWithApp(HomePage, { route: '/' });
      await flushPromises();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5000);
      await flushPromises();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(wrapper.text()).toContain('Planning Call');
      wrapper.unmount();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('shows the moderator badge from viewerRole without the grants map', async () => {
    signInAsHost();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [meetingFactory({ hostId: 'someone-else', viewerRole: 'moderator' })],
      }),
    );
    try {
      const { wrapper } = await mountWithApp(HomePage, { route: '/' });
      await flushPromises();
      expect(wrapper.find('.roleBadge.moderator').text()).toBe('Mod');
      expect(wrapper.find('.actionBtn.edit').exists()).toBe(true);
      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
