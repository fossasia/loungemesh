import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import DesktopVideo from './DesktopVideo.vue';

describe('DesktopVideo', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('detaches when track is cleared', async () => {
    const track = makeTrack('desktop');
    const { wrapper } = await mountWithApp(DesktopVideo, { props: { id: 'u1', track } });
    await wrapper.setProps({ track: undefined });
    wrapper.unmount();
  });
});
