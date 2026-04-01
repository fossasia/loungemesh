import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import LocalStoreLogic from './LocalStoreLogic.vue';

describe('LocalStoreLogic', () => {
  beforeEach(() => setActivePinia(createPinia()));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses proximity worker when available', async () => {
    class MockWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
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
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockRejectedValueOnce(new Error('denied'));
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    expect(local.audio).toBeUndefined();
    wrapper.unmount();
  });

  it('skips track creation when not joined', async () => {
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks');
    const { wrapper } = await mountWithApp(LocalStoreLogic);
    await flushPromises();
    expect(createSpy).not.toHaveBeenCalled();
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
});
