import { describe, it, expect, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import StageVideoAttach from './StageVideoAttach.vue';

describe('StageVideoAttach', () => {
  it('attaches when track changes', async () => {
    const track = makeTrack('video');
    const { wrapper } = await mountWithApp(StageVideoAttach, {
      props: { track, mirrored: true },
    });
    await wrapper.setProps({ track: makeTrack('video') });
    await wrapper.setProps({ track: undefined });
    await flushPromises();
    wrapper.unmount();
  });

  it('mounts without a track', async () => {
    const { wrapper } = await mountWithApp(StageVideoAttach);
    wrapper.unmount();
  });

  it('skips attach and detach when track or element is missing', async () => {
    const track = makeTrack('video');
    const attach = vi.spyOn(track, 'attach');
    const detach = vi.spyOn(track, 'detach');
    const { wrapper } = await mountWithApp(StageVideoAttach, { props: { track } });
    await wrapper.setProps({ track: undefined });
    await flushPromises();
    expect(attach).toHaveBeenCalled();
    expect(detach).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('detaches on unmount', async () => {
    const track = makeTrack('video');
    const detach = vi.spyOn(track, 'detach');
    const { wrapper } = await mountWithApp(StageVideoAttach, { props: { track } });
    await flushPromises();
    wrapper.unmount();
    expect(detach).toHaveBeenCalled();
  });
});
