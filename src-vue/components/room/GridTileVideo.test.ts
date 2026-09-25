import { describe, it, expect, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import GridTileVideo from './GridTileVideo.vue';

describe('GridTileVideo', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('attaches, replaces, and detaches a track', async () => {
    const first = makeTrack('video');
    const second = makeTrack('video');
    const { wrapper } = await mountWithApp(GridTileVideo, {
      props: { track: first, muted: true },
    });
    await flushPromises();
    expect(first.attach).toHaveBeenCalled();
    await wrapper.setProps({ track: second });
    await flushPromises();
    expect(second.attach).toHaveBeenCalled();
    await wrapper.setProps({ track: undefined });
    await flushPromises();
    wrapper.unmount();
  });

  it('renders unmuted by default', async () => {
    const { wrapper } = await mountWithApp(GridTileVideo, { props: { track: makeTrack('video') } });
    expect((wrapper.find('video').element as HTMLVideoElement).muted).toBe(false);
    wrapper.unmount();
  });
});
