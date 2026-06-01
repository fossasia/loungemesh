import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import Room from './Room.vue';

describe('Room', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('loads optional background when API succeeds', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { attributes: { 'bg-img-url': 'https://cdn/bg.png' } } }),
      }),
    );
    const { wrapper } = await mountWithApp(Room, { props: { identifier: 'evt-1' } });
    await flushPromises();
    expect(wrapper.find('.room').attributes('style')).toContain('bg.png');
    wrapper.unmount();
  });

  it('skips fetch when API base is unset but identifier is present', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { wrapper } = await mountWithApp(Room, { props: { identifier: 'evt-1' } });
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('skips fetch without identifier or API base', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', '');
    const { wrapper } = await mountWithApp(Room, { props: { identifier: '' } });
    await flushPromises();
    expect(wrapper.find('.room').attributes('style')).not.toContain('url(');
    wrapper.unmount();
  });

  it('ignores failed background fetch', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { wrapper } = await mountWithApp(Room, { props: { identifier: 'evt-1' } });
    await flushPromises();
    expect(wrapper.find('.room').attributes('style')).not.toContain('url(');
    wrapper.unmount();
  });
});
