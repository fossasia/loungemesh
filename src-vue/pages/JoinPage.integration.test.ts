import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import JoinPage from './JoinPage.vue';

describe('JoinPage (integration)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubEnv('VITE_EVENTYAY_API_BASE', 'https://eventyay.com');
  });

  it('shows access denied when token is missing', async () => {
    const { wrapper } = await mountWithApp(JoinPage, {
      route: '/join/room-a',
      props: { id: 'room-a' },
    });
    await flushPromises();
    expect(wrapper.text()).toMatch(/Access|token/i);
    wrapper.unmount();
  });
});
