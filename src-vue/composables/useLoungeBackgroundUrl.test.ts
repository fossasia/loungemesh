import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLoungeBackgroundUrl } from './useLoungeBackgroundUrl';

const Probe = {
  props: { eventIdentifier: { type: String, default: '' } },
  setup(props: { eventIdentifier: string }) {
    const url = useLoungeBackgroundUrl(() => props.eventIdentifier);
    return { url };
  },
  template: '<span>{{ url }}</span>',
};

describe('useLoungeBackgroundUrl', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('returns host wallpaper from the session store', async () => {
    const features = useSessionFeaturesStore();
    features.gridBackgroundUrl = 'data:image/jpeg;base64,host';
    const { wrapper } = await mountWithApp(Probe);
    await flushPromises();
    expect(wrapper.text()).toContain('data:image/jpeg');
    wrapper.unmount();
  });

  it('fetches optional event wallpaper and ignores failures', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { attributes: { 'bg-img-url': 'https://cdn/bg.png' } } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    const id = ref('evt-1');
    const { wrapper } = await mountWithApp(Probe, { props: { eventIdentifier: 'evt-1' } });
    await flushPromises();
    expect(wrapper.text()).toContain('bg.png');

    id.value = 'evt-2';
    await wrapper.setProps({ eventIdentifier: 'evt-2' });
    await flushPromises();
    expect(wrapper.text()).toBe('');
    wrapper.unmount();
  });

  it('ignores network failures and empty event payloads', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { wrapper } = await mountWithApp(Probe, { props: { eventIdentifier: 'evt-1' } });
    await flushPromises();
    expect(wrapper.text()).toBe('');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { attributes: {} } }),
      }),
    );
    await wrapper.setProps({ eventIdentifier: 'evt-2' });
    await flushPromises();
    expect(wrapper.text()).toBe('');
    wrapper.unmount();
  });

  it('skips fetch when API base is unset', async () => {
    vi.stubEnv('VITE_EVENTYAY_API_BASE', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { wrapper } = await mountWithApp(Probe, { props: { eventIdentifier: 'evt-1' } });
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
