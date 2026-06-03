import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AccessDeniedPage from './AccessDeniedPage.vue';

describe('AccessDeniedPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  const reasons = [
    'no_token',
    'token_expired',
    'token_already_used',
    'event_not_found',
    'network_error',
    undefined,
  ] as const;

  for (const reason of reasons) {
    it(`renders message for ${reason ?? 'default'}`, () => {
      const wrapper = mount(AccessDeniedPage, {
        props: reason ? { reason } : {},
        global: { plugins: [createPinia()] },
      });
      expect(wrapper.find('.denied-msg').text().length).toBeGreaterThan(10);
      wrapper.unmount();
    });
  }
});
