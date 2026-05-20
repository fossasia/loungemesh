import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { mountWithApp } from '@/test/mountApp';
import { getJitsiTestContext } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import JitsiConnection from './JitsiConnection.vue';

describe('JitsiConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function mountConnection(route = '/session/room-a') {
    const Parent = defineComponent({
      components: { JitsiConnection },
      template: '<JitsiConnection />',
    });
    return mountWithApp(Parent, {
      route,
      global: { stubs: { JitsiConnection: false, LocalStoreLogic: true } },
    });
  }

  it('connects, joins, switches rooms, and surfaces errors', async () => {
    const jitsi = getJitsiTestContext();
    const conference = useConferenceStore();
    const connectSpy = vi.spyOn(getMediaEngineInstance(), 'connect');
    const { wrapper, router } = await mountConnection();
    await flushPromises();
    expect(connectSpy).toHaveBeenCalled();

    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();

    conference.isJoining = false;
    conference.isJoined = false;
    conference.conferenceObject = undefined;
    await router.push('/session/room-b');
    await flushPromises();

    jitsi.connection._fire(jitsi.jsMeet.events.conference.CONFERENCE_JOINED);
    conference.isJoined = true;
    conference.conferenceName = 'room-b';
    conference.conferenceObject = getMediaEngineInstance().getConference() as never;
    await router.push('/session/room-c');
    await flushPromises();

    getMediaEngineInstance().disconnect();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_DISCONNECTED);
    await flushPromises();
    await nextTick();
    expect(useMediaEngine().connected.value).toBe(false);

    connectSpy.mockRejectedValueOnce(new Error('connect fail'));
    await router.push('/session/room-d');
    await flushPromises();
    expect(conference.error).toBe('connect fail');

    conference.isJoining = true;
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();

    conference.isJoining = false;
    conference.isJoined = true;
    conference.conferenceName = 'room-d';
    conference.conferenceObject = getMediaEngineInstance().getConference() as never;
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();

    conference.isJoined = false;
    conference.conferenceObject = getMediaEngineInstance().getConference() as never;
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();

    connectSpy.mockRestore();
    wrapper.unmount();
    await flushPromises();
  });

  it('joins the conference after the connection is established', async () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    const joinSpy = vi.spyOn(engine, 'joinRoom');
    const { wrapper } = await mountConnection('/session/room-join');
    await flushPromises();
    const jitsi = getJitsiTestContext();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();
    expect(useConnectionStore().connected).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();

    expect(joinSpy).toHaveBeenCalledWith('room-join', conference.displayName, expect.any(Object));
    expect(conference.conferenceName).toBe('room-join');
    joinSpy.mockRestore();
    wrapper.unmount();
  });

  it('short-circuits when room id is empty or join is not needed', async () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    const leaveSpy = vi.spyOn(engine, 'leaveRoom');
    const joinSpy = vi.spyOn(engine, 'joinRoom');

    const { wrapper, router } = await mountConnection('/session/room-1');
    await flushPromises();
    const jitsi = getJitsiTestContext();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();

    conference.isJoining = true;
    await router.push('/session/room-2');
    await flushPromises();

    conference.isJoining = false;
    conference.isJoined = true;
    conference.conferenceName = 'room-2';
    await router.push('/session/room-2');
    await flushPromises();

    conference.isJoined = true;
    conference.conferenceName = 'room-2';
    await router.push('/session/room-other');
    await flushPromises();
    expect(leaveSpy).toHaveBeenCalled();

    conference.isJoined = false;
    conference.conferenceObject = engine.getConference() as never;
    const joinsBefore = joinSpy.mock.calls.length;
    await router.push('/session/room-3');
    await flushPromises();
    expect(joinSpy.mock.calls.length).toBe(joinsBefore);

    leaveSpy.mockRestore();
    joinSpy.mockRestore();
    wrapper.unmount();
  });

  it('returns before join when already joined or conference object exists', async () => {
    const conference = useConferenceStore();
    const joinSpy = vi.spyOn(getMediaEngineInstance(), 'joinRoom');
    const { wrapper, router } = await mountConnection('/session/room-a');
    await flushPromises();
    getJitsiTestContext().connection._fire(
      getJitsiTestContext().jsMeet.events.connection.CONNECTION_ESTABLISHED,
    );
    await flushPromises();

    conference.isJoining = false;
    conference.isJoined = true;
    conference.conferenceName = 'room-a';
    joinSpy.mockClear();
    const jitsi = getJitsiTestContext();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_DISCONNECTED);
    await flushPromises();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();
    expect(joinSpy).not.toHaveBeenCalled();

    conference.isJoined = false;
    conference.conferenceObject = getMediaEngineInstance().getConference() as never;
    joinSpy.mockClear();
    await router.push('/session/room-c');
    await flushPromises();
    expect(joinSpy).not.toHaveBeenCalled();

    joinSpy.mockRestore();
    wrapper.unmount();
  });

  it('ignores empty route room ids', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/session', name: 'session-empty', component: { template: '<div />' } },
        { path: '/session/:id', name: 'session-with-id', component: { template: '<div />' } },
      ],
    });
    await router.push({ name: 'session-empty' });
    await router.isReady();
    const pinia = createPinia();
    const Parent = defineComponent({
      components: { JitsiConnection },
      template: '<JitsiConnection />',
    });
    const connectSpy = vi.spyOn(getMediaEngineInstance(), 'connect');
    const joinSpy = vi.spyOn(getMediaEngineInstance(), 'joinRoom');
    const wrapper = mount(Parent, {
      global: { plugins: [pinia, router], stubs: { JitsiConnection: false, LocalStoreLogic: true } },
    });
    await flushPromises();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(joinSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
    joinSpy.mockRestore();
    wrapper.unmount();
  });

  it('skips connect when already connected and joins a new room', async () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    const connectSpy = vi.spyOn(engine, 'connect');
    const joinSpy = vi.spyOn(engine, 'joinRoom');
    const { wrapper, router } = await mountConnection('/session/room-a');
    await flushPromises();
    const jitsi = getJitsiTestContext();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await flushPromises();
    expect(useMediaEngine().connected.value).toBe(true);

    const connectsAfterJoin = connectSpy.mock.calls.length;
    conference.isJoining = false;
    conference.isJoined = false;
    conference.conferenceObject = undefined;
    joinSpy.mockClear();
    await router.push('/session/room-b');
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();

    expect(connectSpy.mock.calls.length).toBe(connectsAfterJoin);
    expect(joinSpy).toHaveBeenCalledWith('room-b', conference.displayName, expect.any(Object));

    connectSpy.mockRestore();
    joinSpy.mockRestore();
    wrapper.unmount();
  });

  it('returns early when already joined to the same room', async () => {
    const conference = useConferenceStore();
    const joinSpy = vi.spyOn(getMediaEngineInstance(), 'joinRoom');
    const { wrapper, router } = await mountConnection('/session/same-room');
    await flushPromises();
    getJitsiTestContext().connection._fire(
      getJitsiTestContext().jsMeet.events.connection.CONNECTION_ESTABLISHED,
    );
    await flushPromises();

    conference.isJoining = false;
    conference.isJoined = true;
    conference.conferenceName = 'same-room';
    joinSpy.mockClear();
    await router.push('/session/same-room');
    await flushPromises();
    expect(joinSpy).not.toHaveBeenCalled();

    joinSpy.mockRestore();
    wrapper.unmount();
  });

  it('records non-Error connect failures', async () => {
    const conference = useConferenceStore();
    const connectSpy = vi.spyOn(getMediaEngineInstance(), 'connect').mockRejectedValueOnce('offline');
    const { wrapper } = await mountConnection('/session/room-z');
    await flushPromises();
    expect(conference.error).toBe('offline');
    connectSpy.mockRestore();
    wrapper.unmount();
  });

  it('removes the pagehide listener and cleans up on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { wrapper } = await mountWithApp(JitsiConnection, {
      route: '/session/room-unmount',
      global: { stubs: { LocalStoreLogic: true } },
    });
    await flushPromises();
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('stops local media when the page is hidden', async () => {
    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(JitsiConnection, {
      route: '/session/room-pagehide',
      global: { stubs: { LocalStoreLogic: true } },
    });
    await flushPromises();
    window.dispatchEvent(new Event('pagehide'));
    expect(stopSpy).toHaveBeenCalled();
    stopSpy.mockRestore();
    wrapper.unmount();
  });

  it('records non-Error join failures', async () => {
    const conference = useConferenceStore();
    const joinSpy = vi.spyOn(getMediaEngineInstance(), 'joinRoom').mockRejectedValueOnce('plain failure');
    const { wrapper } = await mountConnection('/session/room-z');
    await flushPromises();
    getJitsiTestContext().connection._fire(
      getJitsiTestContext().jsMeet.events.connection.CONNECTION_ESTABLISHED,
    );
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(conference.error).toBe('plain failure');
    joinSpy.mockRestore();
    wrapper.unmount();
  });
});
