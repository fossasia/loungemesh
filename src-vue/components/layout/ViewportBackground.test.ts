import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import ViewportBackground from './ViewportBackground.vue';

describe('ViewportBackground', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders host wallpaper as a fixed viewport layer', async () => {
    const features = useSessionFeaturesStore();
    features.gridBackgroundUrl = 'data:image/jpeg;base64,host';
    const { wrapper } = await mountWithApp(ViewportBackground);
    await flushPromises();
    const layer = wrapper.find('.viewportBackground');
    expect(layer.exists()).toBe(true);
    expect(layer.attributes('style')).toContain('data:image/jpeg');
    expect(layer.classes()).toContain('viewportBackground');
    wrapper.unmount();
  });

  it('loads optional event wallpaper when API succeeds', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { attributes: { 'bg-img-url': 'https://cdn/bg.png' } } }),
      }),
    );
    const { wrapper } = await mountWithApp(ViewportBackground, {
      props: { eventIdentifier: 'evt-1' },
    });
    await flushPromises();
    expect(wrapper.find('.viewportBackground').attributes('style')).toContain('bg.png');
    wrapper.unmount();
  });

  it('prefers host wallpaper over event background', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { attributes: { 'bg-img-url': 'https://cdn/event.png' } } }),
      }),
    );
    const features = useSessionFeaturesStore();
    features.gridBackgroundUrl = 'data:image/jpeg;base64,host';
    const { wrapper } = await mountWithApp(ViewportBackground, {
      props: { eventIdentifier: 'evt-1' },
    });
    await flushPromises();
    expect(wrapper.find('.viewportBackground').attributes('style')).toContain('data:image/jpeg');
    wrapper.unmount();
  });

  it('renders nothing without a wallpaper', async () => {
    const { wrapper } = await mountWithApp(ViewportBackground);
    await flushPromises();
    expect(wrapper.find('.viewportBackground').exists()).toBe(false);
    wrapper.unmount();
  });
});
