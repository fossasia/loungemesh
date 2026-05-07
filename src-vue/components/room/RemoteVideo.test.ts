import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import RemoteVideo from './RemoteVideo.vue';

describe('RemoteVideo', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('attaches when a track is provided after mount', async () => {
    const track = makeTrack('video');
    const attach = vi.spyOn(track, 'attach');
    const { wrapper } = await mountWithApp(RemoteVideo, { props: { id: 'u1' } });
    await wrapper.setProps({ track });
    await flushPromises();
    expect(attach).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('attaches and detaches when track changes', async () => {
    const track = makeTrack('video');
    const track2 = makeTrack('video');
    const attach = vi.spyOn(track, 'attach');
    const detach = vi.spyOn(track, 'detach');
    const { wrapper } = await mountWithApp(RemoteVideo, { props: { id: 'u1', track } });
    await wrapper.setProps({ track: track2 });
    await flushPromises();
    expect(detach).toHaveBeenCalled();
    await wrapper.setProps({ track: undefined });
    wrapper.unmount();
    expect(attach).toHaveBeenCalled();
  });
});
