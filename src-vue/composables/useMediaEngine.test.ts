import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import type { JitsiTrack } from '@/types/jitsi';
import { resetMediaEngineWiringForTests } from '@/composables/mediaEngineWiringState';
import { getJitsiTestContext } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { clearStoredAccess } from '@/composables/useAccessGuard';
import { mountWithApp } from '@/test/mountApp';
import { useMediaEngine } from './useMediaEngine';

function storeJwtAccess() {
  sessionStorage.setItem(
    'flowspace:access',
    JSON.stringify({
      jwt: 'stored-jwt',
      displayName: 'Alice',
      jitsiRoom: 'room',
      opaqueToken: 'opaque',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
}

describe('useMediaEngine', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    clearStoredAccess();
    storeJwtAccess();
    resetMediaEngineWiringForTests();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jwt: 'refreshed' }) }));
    vi.stubEnv('VITE_EVENTYAY_JWT_ENDPOINT', 'https://eventyay.test/jwt');
  });

  it('wires store sync and exposes engine actions', async () => {
    const jitsi = getJitsiTestContext();
    const api = useMediaEngine();
    const ev = jitsi.jsMeet.events;
    const conference = (await import('@/stores/conferenceStore')).useConferenceStore();

    conference.addUser('u2');
    conference.addUser('u3');

    await api.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await flushPromises();
    expect(api.connected.value).toBe(true);

    await api.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    jitsi.conference._fire(ev.conference.USER_JOINED, 'u1', {});
    jitsi.conference._fire(ev.conference.USER_LEFT, 'u1');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'u2',
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
      getOriginalStream: () => ({}) as MediaStream,
    } as JitsiTrack);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'u3',
      getType: () => 'video',
      videoType: 'desktop',
      isLocal: () => false,
    } as JitsiTrack);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack);
    jitsi.conference._fire(ev.conference.MESSAGE_RECEIVED, 'u1', 'hi', 1);
    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'u2',
      _properties: { onStage: true },
    });
    jitsi.conference._handlers.get('cmd:pos')?.({
      value: JSON.stringify({ id: 'u2', x: 1, y: 2 }),
    });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: 'not-json' });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: JSON.stringify({ id: 'u2' }) });
    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'ghost',
      _properties: { onStage: true },
    });
    jitsi.connection._fire(ev.connection.CONNECTION_FAILED);
    jitsi.conference._fire(ev.conference.CONFERENCE_ERROR);
    jitsi.connection._fire(ev.connection.CONNECTION_DISCONNECTED);

    await api.connect({ jwt: 'x' });
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await flushPromises();
    api.disconnect();
    expect(api.connected.value).toBe(false);

    await api.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await flushPromises();
    await api.joinRoom('room2', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(api.getConference()).toBe(jitsi.conference);
    api.leaveRoom();
    expect(api.getConference()).toBeUndefined();
    api.setParticipantVolume('u1', 0.5);
    await api.createLocalTracks(['audio']);

    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue(undefined);
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'cam',
      getType: () => 'video',
      videoType: 'camera',
      isLocal: () => false,
    } as JitsiTrack);

    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'new-audio',
      getType: () => 'audio',
      isMuted: () => true,
      isLocal: () => false,
    } as JitsiTrack);
    conference.addUser('existing');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'existing',
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack);
    expect(conference.users['new-audio']).toBeDefined();
  });

  it('wires token refresh callbacks', async () => {
    resetMediaEngineWiringForTests();
    storeJwtAccess();
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com');
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true });
    Object.defineProperty(window, 'top', { value: { postMessage }, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const { useEventyayBridge } = await import('./useEvenytayBridge');
    const engine = getMediaEngineInstance();
    const connectSpy = vi.spyOn(engine, 'connect');
    useMediaEngine();

    await engine.connect();
    await engine.joinRoom('room', 'Alice', {});
    const jitsi = getJitsiTestContext();
    jitsi.conference._fire(jitsi.jsMeet.events.conference.CONFERENCE_FAILED, 'not-authorized');
    await flushPromises();

    const Comp = defineComponent({
      setup: () => useEventyayBridge(),
      template: '<div />',
    });
    const { wrapper } = await mountWithApp(Comp);
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://eventyay.com',
        data: { source: 'eventyay', type: 'flowspace:new_token', jwt: 'injected-jwt' },
      }),
    );
    await flushPromises();
    expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({ jwt: 'injected-jwt' }));
    connectSpy.mockRestore();
    wrapper.unmount();
  });

  it('ignores malformed and incomplete position commands', async () => {
    resetMediaEngineWiringForTests();
    const { useConferenceStore } = await import('@/stores/conferenceStore');
    useMediaEngine();
    const conference = useConferenceStore();
    conference.addUser('u2');
    const jitsi = getJitsiTestContext();
    const engine = getMediaEngineInstance();
    await engine.connect();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    const before = { ...conference.users.u2.pos };
    jitsi.conference._handlers.get('cmd:pos')?.({ value: JSON.stringify({ id: 'u2', y: 1 }) });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: 'not-json' });
    expect(conference.users.u2.pos).toEqual(before);
  });

  it('applies position commands from the conference', async () => {
    resetMediaEngineWiringForTests();
    const { useConferenceStore } = await import('@/stores/conferenceStore');
    useMediaEngine();
    const conference = useConferenceStore();
    conference.addUser('u2');
    const jitsi = getJitsiTestContext();
    const engine = getMediaEngineInstance();
    await engine.connect();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._handlers.get('cmd:pos')?.({
      value: JSON.stringify({ id: 'u2', x: 9, y: 8 }),
    });
    expect(conference.users.u2.pos).toEqual({ x: 9, y: 8 });
  });

  it('reuses media engine wiring on subsequent calls', () => {
    const api1 = useMediaEngine();
    const api2 = useMediaEngine();
    expect(api1.engine).toBe(api2.engine);
  });

  it('connects without a stored jwt when none is passed', async () => {
    clearStoredAccess();
    const jitsi = getJitsiTestContext();
    const connectSpy = vi.spyOn(getMediaEngineInstance(), 'connect');
    const api = useMediaEngine();
    await api.connect();
    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    expect(connectSpy).toHaveBeenCalledWith(undefined);
  });

  it('records conference errors after the room disconnects', async () => {
    const jitsi = getJitsiTestContext();
    const api = useMediaEngine();
    const ev = jitsi.jsMeet.events;
    await api.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await api.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    api.leaveRoom();
    jitsi.conference._fire(ev.conference.CONFERENCE_ERROR);
    expect(api.joined.value).toBe(false);
    expect(api.engineError.value).toBeTruthy();
  });

  it('ignores empty conference errors after leave', async () => {
    const jitsi = getJitsiTestContext();
    const api = useMediaEngine();
    const ev = jitsi.jsMeet.events;
    await api.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await api.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    api.leaveRoom();
    jitsi.connection.xmpp = {};
    jitsi.conference._fire(ev.conference.CONFERENCE_ERROR);
    expect(api.engineError.value).toBeUndefined();
  });

  it('keeps joined state when conference errors during an active call', async () => {
    const jitsi = getJitsiTestContext();
    const api = useMediaEngine();
    const ev = jitsi.jsMeet.events;
    await api.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await api.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(api.joined.value).toBe(true);
    vi.spyOn(getMediaEngineInstance(), 'isJoined').mockReturnValue(true);
    jitsi.conference._fire(ev.conference.CONFERENCE_FAILED, 'room unavailable');
    expect(api.joined.value).toBe(true);
    expect(api.engineError.value).toBeUndefined();
  });

  it('rethrows joinRoom errors and clears isJoining', async () => {
    const jitsi = getJitsiTestContext();
    const engine = getMediaEngineInstance();
    const api = useMediaEngine();
    const { useConferenceStore } = await import('@/stores/conferenceStore');
    const conference = useConferenceStore();

    jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await api.connect();

    const joinSpy = vi.spyOn(engine, 'joinRoom').mockRejectedValueOnce(new Error('join failed'));
    await expect(api.joinRoom('r', 'A', {})).rejects.toThrow('join failed');
    expect(conference.isJoining).toBe(false);
    joinSpy.mockRestore();
  });
});
