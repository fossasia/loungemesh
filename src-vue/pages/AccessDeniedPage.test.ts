import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AccessDeniedPage from './AccessDeniedPage.vue';

describe('AccessDeniedPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  const reasons = [
    'room_full',
    'not_allowed',
    'grant_expired',
    'token_expired',
    'single_user_replayed',
    'token_already_claimed',
    'invalid_pin',
    'grant_replayed',
    'token_already_used',
    'meet_not_found',
    'event_not_found',
    'no_token',
    'network_error',
    undefined,
  ] as const;

  for (const reason of reasons) {
    it(`renders message for ${reason ?? 'default'}`, () => {
      const wrapper = mount(AccessDeniedPage, {
        props: reason ? { reason } : {},
        global: { plugins: [createPinia()] },
      });
      expect(wrapper.find('.message').text().length).toBeGreaterThan(10);
      wrapper.unmount();
    });
  }
});
