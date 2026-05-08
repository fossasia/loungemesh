import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import LocalStoreLogic from './LocalStoreLogic.vue';
import { watchTrackSpeaking } from '@/utils/speakingMeter';

vi.mock('@/utils/speakingMeter', () => ({
  watchTrackSpeaking: vi.fn(),
}));

describe('LocalStoreLogic', () => {
  beforeEach(() => setActivePinia(createPinia()));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses proximity worker when available', async () => {
    class MockWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      terminate() {}
      postMessage() {
        this.onmessage?.({
          data: { volumes: [{ id: 'u1', volume: 0.3 }] },
        } as MessageEvent);
      }
    }
    vi.stubGlobal('Worker', MockWorker);

    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.addUser('u1');
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.setMyID('me');

    const { wrapper } = await mountWithApp(LocalStoreLogic);
    local.pos = { x: 1, y: 2 };
    await nextTick();
    await flushPromises();
    expect(conference.users.u1.volume).toBe(0.3);
    wrapper.unmount();
  });

  it('falls back when worker init fails', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('no worker');
        }
      },
    );

    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.addUser('u1');
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.setMyID('me');
    local.audio = makeTrack('audio');

    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    local.pos = { x: 3, y: 4 };
    await nextTick();
    expect(getMediaEngineInstance().sendCommand).toBeDefined();
    wrapper.unmount();
  });

  it('ignores worker volumes for unknown users', async () => {
    const volSpy = vi.spyOn(getMediaEngineInstance(), 'setParticipantVolume');
    class MockWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      terminate() {}
      postMessage() {
        this.onmessage?.({
          data: { volumes: [{ id: 'unknown', volume: 0.4 }] },
        } as MessageEvent);
      }
    }
    vi.stubGlobal('Worker', MockWorker);

    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.setMyID('me');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    local.pos = { x: 1, y: 2 };
    await flushPromises();
    expect(volSpy).not.toHaveBeenCalled();
    volSpy.mockRestore();
    wrapper.unmount();
  });

  it('handles createLocalTracks failure when joined', async () => {
    const conference = useConferenceStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockRejectedValueOnce(new Error('denied'));
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    createSpy.mockRestore();
    wrapper.unmount();
  });

  it('skips createLocalTracks when already present', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.audio = makeTrack('audio');
    local.video = makeTrack('video');
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks');

    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
    wrapper.unmount();
  });

  it('does not post position updates without local id', async () => {
    const conference = useConferenceStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    const local = useLocalStore();
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    local.id = '';
    local.pos = { x: 1, y: 2 };
    await nextTick();
    expect(cmdSpy).not.toHaveBeenCalled();
    cmdSpy.mockRestore();
    wrapper.unmount();
  });

  it('handles createLocalTracks rejection when joining', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.isJoined = true;
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockRejectedValue(new Error('denied'));
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    expect(local.audio).toBeUndefined();
    wrapper.unmount();
  });

  it('requests media on mount even when not joined', async () => {
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    expect(createSpy).toHaveBeenCalled();
    createSpy.mockRestore();
    wrapper.unmount();
  });

  it('skips undefined tracks when adding to conference', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    vi.spyOn(engine, 'getConference').mockReturnValue({} as never);
    local.audio = makeTrack('audio');
    local.video = makeTrack('video');
    const addSpy = vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    addSpy.mockClear();
    local.video = undefined;
    await flushPromises();
    await nextTick();
    expect(addSpy.mock.calls.every(([track]) => track !== undefined)).toBe(true);
    addSpy.mockRestore();
    wrapper.unmount();
  });

  it('publishes speaking state via participant property', async () => {
    vi.mocked(watchTrackSpeaking).mockImplementation((_track, onChange) => {
      onChange(true);
      return () => {};
    });
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.audio = makeTrack('audio');
    const propSpy = vi.spyOn(getMediaEngineInstance(), 'setLocalParticipantProperty');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    expect(local.speaking).toBe(true);
    expect(propSpy).toHaveBeenCalledWith('speaking', true);
    propSpy.mockRestore();
    wrapper.unmount();
  });

  it('recenters viewport on window resize', async () => {
    const local = useLocalStore();
    const resetSpy = vi.spyOn(local, 'resetViewportForRoom');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    window.dispatchEvent(new Event('resize'));
    expect(resetSpy).toHaveBeenCalled();
    resetSpy.mockRestore();
    wrapper.unmount();
  });

  it('does not request media when connection store disconnects', async () => {
    const connection = useConnectionStore();
    connection.connected = true;
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    createSpy.mockClear();
    connection.connected = false;
    await flushPromises();
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
    wrapper.unmount();
  });

  it('requests media when connection store becomes connected', async () => {
    const connection = useConnectionStore();
    const local = useLocalStore();
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    local.audio = undefined;
    local.video = undefined;
    createSpy.mockClear();
    connection.connected = true;
    await flushPromises();
    expect(createSpy).toHaveBeenCalled();
    createSpy.mockRestore();
    wrapper.unmount();
  });

  it('expands room bounds when remote users change', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    const boundsSpy = vi.spyOn(local, 'ensureRoomBounds');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    boundsSpy.mockClear();
    conference.addUser('peer');
    await flushPromises();
    expect(boundsSpy).toHaveBeenCalled();
    boundsSpy.mockRestore();
    wrapper.unmount();
  });

  it('adds local tracks to conference when joined', async () => {
    const { conference } = await connectAndJoinTestConference();
    conference.isJoined = true;
    const local = useLocalStore();
    const addSpy = vi.spyOn(getMediaEngineInstance(), 'addLocalTrack').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    local.audio = makeTrack('audio');
    local.video = makeTrack('video');
    await flushPromises();
    await nextTick();
    expect(addSpy).toHaveBeenCalled();
    addSpy.mockRestore();
    wrapper.unmount();
  });

  it('sets full gain when remote user overlaps local position', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('no worker');
        }
      },
    );
    const volSpy = vi.spyOn(getMediaEngineInstance(), 'setParticipantVolume');
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.setMyID('me');
    local.pos = { x: 200, y: 300 };
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    conference.addUser('u1');
    conference.patchUser('u1', { pos: { x: 200, y: 300 } });
    await flushPromises();
    expect(volSpy).toHaveBeenCalledWith('u1', 1);
    volSpy.mockRestore();
    wrapper.unmount();
  });

  it('keeps muted remote users silent even when overlapping', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('no worker');
        }
      },
    );
    const volSpy = vi.spyOn(getMediaEngineInstance(), 'setParticipantVolume');
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.isJoined = true;
    conference.conferenceObject = {} as never;
    local.setMyID('me');
    local.pos = { x: 0, y: 0 };
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    conference.addUser('u1');
    conference.patchUser('u1', { pos: { x: 0, y: 0 }, mute: true });
    await flushPromises();
    expect(volSpy).toHaveBeenCalledWith('u1', 0);
    volSpy.mockRestore();
    wrapper.unmount();
  });
});
