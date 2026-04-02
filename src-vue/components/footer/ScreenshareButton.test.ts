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

  it('adds a desktop track when none exists', async () => {
    await connectAndJoinTestConference();
    getJitsiTestContext().conference.getLocalVideoTrack = vi.fn(() => undefined);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(getJitsiTestContext().jsMeet.createLocalTracks).toHaveBeenCalled();
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

  it('logs errors when track creation fails', async () => {
    await connectAndJoinTestConference();
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockRejectedValueOnce(new Error('fail'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(errSpy).toHaveBeenCalled();
    createSpy.mockRestore();
    errSpy.mockRestore();
    wrapper.unmount();
  });
});
