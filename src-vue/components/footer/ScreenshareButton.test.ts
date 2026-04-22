import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference, getJitsiTestContext } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import ScreenshareButton from './ScreenshareButton.vue';

describe('ScreenshareButton', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('preserves audio track when starting screenshare', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    local.audio = makeTrack('audio');
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => undefined);
    const setSpy = vi.spyOn(local, 'setLocalTracks');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(setSpy).toHaveBeenCalledWith(expect.arrayContaining([local.audio]));
    setSpy.mockRestore();
    wrapper.unmount();
  });

  it('replaces camera when starting share with an existing video track', async () => {
    await connectAndJoinTestConference();
    const camera = makeTrack('video');
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => camera);
    const replaceSpy = vi.spyOn(getMediaEngineInstance(), 'replaceLocalTrack').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(replaceSpy).toHaveBeenCalledWith(camera, expect.anything());
    wrapper.unmount();
  });

  it('no-ops when desktop track creation returns a non-desktop video', async () => {
    await connectAndJoinTestConference();
    const camera = makeTrack('video');
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => undefined);
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockResolvedValueOnce([camera]);
    const addSpy = vi.spyOn(getMediaEngineInstance(), 'addLocalTrack');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(addSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('adds a desktop track when none exists', async () => {
    await connectAndJoinTestConference();
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => undefined);
    const addSpy = vi.spyOn(getMediaEngineInstance(), 'addLocalTrack').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(getJitsiTestContext().jsMeet.createLocalTracks).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('stops sharing when toggling off desktop track', async () => {
    const { jitsi } = await connectAndJoinTestConference();
    const desktop = makeTrack('desktop');
    const camera = makeTrack('video');
    jitsi.conference.getLocalVideoTrack = vi.fn(() => desktop);
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([camera]);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    wrapper.unmount();
  });

  it('replaces an existing desktop track with camera', async () => {
    const { jitsi } = await connectAndJoinTestConference();
    const oldTrack = makeTrack('desktop');
    const newTrack = makeTrack('video');
    jitsi.conference.getLocalVideoTrack = vi.fn(() => oldTrack);
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([newTrack]);
    const replaceSpy = vi.spyOn(engine, 'replaceLocalTrack').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(replaceSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('no-ops when not in a conference', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue(undefined);
    const createSpy = vi.spyOn(engine, 'createLocalTracks');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    expect(createSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('handles missing new track from createLocalTracks', async () => {
    await connectAndJoinTestConference();
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => undefined);
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockResolvedValueOnce([]);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    wrapper.unmount();
  });

  it('skips end-watch binding when video track is not desktop', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    const camera = makeTrack('video');
    local.video = camera;
    local.videoType = 'desktop';
    const { wrapper } = await mountWithApp(ScreenshareButton);
    wrapper.unmount();
  });

  it('skips end-watch binding when no video track is set', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    local.video = undefined;
    local.videoType = 'desktop';
    const { wrapper } = await mountWithApp(ScreenshareButton);
    wrapper.unmount();
  });

  it('cleans up desktop end listener on unmount', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    local.video = makeTrack('desktop');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    wrapper.unmount();
  });

  it('restores camera when the browser ends desktop capture', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    const listeners: Record<string, () => void> = {};
    const vt = {
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    const desktop = makeTrack('desktop');
    (desktop as { getOriginalStream?: () => MediaStream }).getOriginalStream = () =>
      ({ getVideoTracks: () => [vt] }) as unknown as MediaStream;
    const camera = makeTrack('video');
    local.video = desktop;
    local.videoType = 'desktop';
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => desktop);
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockResolvedValue([camera]);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    listeners.ended?.();
    await flushPromises();
    expect(local.videoType).toBe('camera');
    wrapper.unmount();
  });

  it('clears sharing state when startShare throws', async () => {
    await connectAndJoinTestConference();
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockRejectedValueOnce(
      new Error('denied'),
    );
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(wrapper.find('button.ibtn').classes()).not.toContain('active');
    wrapper.unmount();
  });

  it('clears sharing state when track creation fails', async () => {
    await connectAndJoinTestConference();
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockRejectedValueOnce(new Error('fail'));
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(wrapper.find('button.ibtn').classes()).not.toContain('active');
    wrapper.unmount();
  });
});
