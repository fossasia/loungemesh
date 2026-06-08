import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import ScreenshareVideo from './ScreenshareVideo.vue';

describe('ScreenshareVideo', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  it('attaches and detaches track on mount and props change', async () => {
    const track1 = makeTrack('desktop');
    const track2 = makeTrack('desktop');
    const { wrapper } = await mountWithApp(ScreenshareVideo, { props: { track: track1 } });
    await flushPromises();
    expect(track1.attach).toHaveBeenCalled();

    await wrapper.setProps({ track: track2 });
    await flushPromises();
    expect(track1.detach).toHaveBeenCalled();
    expect(track2.attach).toHaveBeenCalled();

    wrapper.unmount();
    expect(track2.detach).toHaveBeenCalled();
  });

  it('handles attach errors gracefully', async () => {
    const track = makeTrack('desktop');
    track.attach = vi.fn().mockImplementation(() => {
      throw new Error('attach failed');
    }) as never;
    const { wrapper } = await mountWithApp(ScreenshareVideo, { props: { track } });
    await flushPromises();
    wrapper.unmount();
  });

  it('handles detach errors gracefully', async () => {
    const track = makeTrack('desktop');
    track.detach = vi.fn().mockImplementation(() => {
      throw new Error('detach failed');
    }) as never;
    const { wrapper } = await mountWithApp(ScreenshareVideo, { props: { track } });
    await flushPromises();
    wrapper.unmount();
  });

  it('handles play rejection gracefully', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('play blocked'));
    const track = makeTrack('desktop');
    const { wrapper } = await mountWithApp(ScreenshareVideo, { props: { track } });
    await flushPromises();
    wrapper.unmount();
  });

  it('covers various branches of attach and detach', async () => {
    // 1. play() returns undefined (no promise), paused is true (default)
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(undefined as any);

    const track1 = makeTrack('desktop');
    const { wrapper } = await mountWithApp(ScreenshareVideo, { props: { track: track1 } });
    await flushPromises();

    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();

    // 2. video is not paused
    const pausedSpy = vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);

    // 3. transition from track to undefined
    await wrapper.setProps({ track: undefined as any });
    await flushPromises();

    // 4. transition from undefined to track
    await wrapper.setProps({ track: track1 });
    await flushPromises();

    // 5. transition back to undefined before unmounting
    await wrapper.setProps({ track: undefined as any });
    await flushPromises();

    pausedSpy.mockRestore();
    wrapper.unmount();
  });

  it('handles mount and immediate unmount gracefully', async () => {
    const track = makeTrack('desktop');
    const { wrapper } = await mountWithApp(ScreenshareVideo, { props: { track } });
    wrapper.unmount();
    await flushPromises();
  });
});
