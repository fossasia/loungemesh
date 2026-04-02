import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createTestRouter } from '@/test/mountApp';
import JoinPage from './JoinPage.vue';
import AccessDeniedPage from './AccessDeniedPage.vue';

const check = vi.fn();
const state = ref<{ status: string; reason?: string }>({ status: 'idle' });

vi.mock('@/composables/useAccessGuard', () => ({
  useAccessGuard: () => ({ state, check }),
}));

describe('JoinPage', () => {
  beforeEach(() => {
    check.mockReset();
    state.value = { status: 'idle' };
  });

  it('redirects to session when access is granted', async () => {
    check.mockImplementation(async () => {
      state.value = { status: 'granted' };
      return { status: 'granted', jwt: null, displayName: '', jitsiRoom: 'room-a' };
    });
    const pinia = createPinia();
    const router = await createTestRouter('/join/room-a?token=t');
    const replace = vi.spyOn(router, 'replace');
    const wrapper = mount(JoinPage, {
      props: { id: 'room-a' },
      global: { plugins: [pinia, router] },
    });
    await flushPromises();
    await nextTick();
    expect(check).toHaveBeenCalledWith('room-a');
    expect(replace).toHaveBeenCalledWith({ name: 'session', params: { id: 'room-a' } });
    wrapper.unmount();
  });

  it('does nothing when check returns an unexpected status', async () => {
    check.mockResolvedValue({ status: 'idle' } as never);
    const pinia = createPinia();
    const router = await createTestRouter('/join/room-a?token=t');
    const replace = vi.spyOn(router, 'replace');
    const wrapper = mount(JoinPage, {
      props: { id: 'room-a' },
      global: { plugins: [pinia, router] },
    });
    await flushPromises();
    expect(replace).not.toHaveBeenCalled();
    expect(wrapper.findComponent(AccessDeniedPage).exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows loading UI while access is being verified', async () => {
    check.mockImplementation(() => new Promise(() => undefined));
    state.value = { status: 'loading' };
    const pinia = createPinia();
    const router = await createTestRouter('/join/room-a?token=t');
    const wrapper = mount(JoinPage, {
      props: { id: 'room-a' },
      global: { plugins: [pinia, router] },
    });
    expect(wrapper.text()).toContain('Verifying access');
    wrapper.unmount();
  });

  it('shows denied page when access fails (mocked guard)', async () => {
    check.mockImplementation(async () => {
      state.value = { status: 'denied', reason: 'no_token' };
      return { status: 'denied', reason: 'no_token' };
    });
    const pinia = createPinia();
    const router = await createTestRouter('/join/room-a');
    const wrapper = mount(JoinPage, {
      props: { id: 'room-a' },
      global: { plugins: [pinia, router] },
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.findComponent(AccessDeniedPage).exists()).toBe(true);
    wrapper.unmount();
  });
});
