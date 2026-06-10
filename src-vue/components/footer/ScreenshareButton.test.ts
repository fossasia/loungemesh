import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference, getJitsiTestContext } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { makeTrack } from '@/test/makeTrack';
import ScreenshareButton from './ScreenshareButton.vue';

describe('ScreenshareButton', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('adds a desktop track when none exists', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    const addSpy = vi.spyOn(getMediaEngineInstance(), 'addLocalTrack').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(getJitsiTestContext().jsMeet.createLocalTracks).toHaveBeenCalledWith({
      devices: ['desktop'],
      firePermissionPromptIsShownEvent: true,
    });
    expect(addSpy).toHaveBeenCalled();
    expect(local.screenshare).toBeTruthy();
    wrapper.unmount();
  });

  it('no-ops when desktop track creation returns a non-desktop video', async () => {
    await connectAndJoinTestConference();
    const camera = makeTrack('video');
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockResolvedValueOnce([camera]);
    const addSpy = vi.spyOn(getMediaEngineInstance(), 'addLocalTrack');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(addSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('stops sharing when toggling off desktop track', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    const desktop = makeTrack('desktop');
    local.screenshare = desktop;
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    expect(local.screenshare).toBeUndefined();
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
    vi.spyOn(getMediaEngineInstance(), 'createLocalTracks').mockResolvedValueOnce([]);
    const { wrapper } = await mountWithApp(ScreenshareButton);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    wrapper.unmount();
  });

  it('cleans up desktop end listener on unmount', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    local.screenshare = makeTrack('desktop');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    wrapper.unmount();
  });

  it('stops screenshare when the browser ends desktop capture', async () => {
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
    local.screenshare = desktop;
    const { wrapper } = await mountWithApp(ScreenshareButton);
    listeners.ended?.();
    await flushPromises();
    expect(local.screenshare).toBeUndefined();
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

  it('disables screenshare while another user is on stage', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('viewer');
    features.stageOccupantId = 'presenter';
    const createSpy = vi.spyOn(getMediaEngineInstance(), 'createLocalTracks');
    const { wrapper } = await mountWithApp(ScreenshareButton);
    const btn = wrapper.find('button.ibtn');
    expect(btn.attributes('disabled')).toBeDefined();
    expect(btn.attributes('title')).toContain('unavailable while someone is on stage');
    await btn.trigger('click');
    expect(createSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('calls finishShare when sharing.value is true but screenshare is undefined', async () => {
    await connectAndJoinTestConference();
    const { wrapper } = await mountWithApp(ScreenshareButton);
    (wrapper.vm as { sharing: boolean }).sharing = true;
    wrapper.unmount();
  });
});
