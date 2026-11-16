import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ConnectionBanner from './ConnectionBanner.vue';
import { useReconnectStore } from '@/stores/reconnectStore';

describe('ConnectionBanner.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders nothing when phase is online', () => {
    const wrapper = mount(ConnectionBanner);
    expect(wrapper.find('[data-testid="connection-banner"]').exists()).toBe(false);
  });

  it('renders countdown and retry button when waiting', async () => {
    const store = useReconnectStore();
    store.phase = 'waiting';
    store.secondsLeft = 15;
    store.attempt = 2;

    const retrySpy = vi.spyOn(store, 'retryNow');

    const wrapper = mount(ConnectionBanner);
    expect(wrapper.find('[data-testid="connection-banner"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('15s');
    expect(wrapper.text()).toContain('(attempt 2 of 5)');

    const retryBtn = wrapper.find('[data-testid="btn-retry-now"]');
    expect(retryBtn.exists()).toBe(true);
    await retryBtn.trigger('click');
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('renders attempting indicator when attempting', async () => {
    const store = useReconnectStore();
    store.phase = 'attempting';
    store.attempt = 3;

    const wrapper = mount(ConnectionBanner);
    expect(wrapper.find('.bannerSpinner').exists()).toBe(true);
    expect(wrapper.text()).toContain('Reconnecting to room');
    expect(wrapper.text()).toContain('(attempt 3 of 5)');
  });

  it('renders exhausted message and reload button', async () => {
    const store = useReconnectStore();
    store.phase = 'exhausted';
    store.attempt = 5;

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    const wrapper = mount(ConnectionBanner);
    expect(wrapper.text()).toContain('Connection lost');
    const reloadBtn = wrapper.find('[data-testid="btn-reload"]');
    expect(reloadBtn.exists()).toBe(true);

    await reloadBtn.trigger('click');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('renders reconnected success message when recovered', async () => {
    const store = useReconnectStore();
    store.phase = 'recovered';

    const wrapper = mount(ConnectionBanner);
    expect(wrapper.text()).toContain('Reconnected to meeting');
  });
});
