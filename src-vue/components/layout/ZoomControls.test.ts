import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import ZoomControls from './ZoomControls.vue';

describe('ZoomControls', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('zooms in and out', async () => {
    const local = useLocalStore();
    const start = local.scale;
    const { wrapper } = await mountWithApp(ZoomControls);
    const buttons = wrapper.findAll('button.ibtn');
    await buttons[0].trigger('click');
    expect(local.scale).toBeGreaterThan(start);
    const mid = local.scale;
    await buttons[1].trigger('click');
    expect(local.scale).toBeLessThan(mid);
    wrapper.unmount();
  });

  it('stops pointer and click propagation on the control strip', async () => {
    const { wrapper } = await mountWithApp(ZoomControls);
    const strip = wrapper.find('.zoomCtl');
    await strip.trigger('pointerdown');
    await strip.trigger('click');
    wrapper.unmount();
  });
});
