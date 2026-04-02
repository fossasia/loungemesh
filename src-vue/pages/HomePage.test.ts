import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import HomePage from './HomePage.vue';

describe('HomePage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('mounts and submits a custom session name', async () => {
    const { wrapper, router } = await mountWithApp(HomePage, { route: '/' });
    expect(wrapper.text()).toContain('Flowspace');
    const push = vi.spyOn(router, 'push');
    await wrapper.find('input[type="text"]').setValue('my-room');
    await wrapper.find('form').trigger('submit');
    expect(push).toHaveBeenCalledWith('/session/my-room');
    wrapper.unmount();
  });
});
