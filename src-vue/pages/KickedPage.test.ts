import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import KickedPage from './KickedPage.vue';

describe('KickedPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders kicked out text, counts down and redirects', async () => {
    const { wrapper, router } = await mountWithApp(KickedPage);

    expect(wrapper.text()).toContain('Access Revoked');
    expect(wrapper.text()).toContain('Redirecting to home...');
    
    // Initial countdown value
    expect(wrapper.find('.timerNumber').text()).toBe('10');

    // Advance 5 seconds
    vi.advanceTimersByTime(5000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.timerNumber').text()).toBe('5');

    // Advance another 5 seconds to finish countdown
    const pushSpy = vi.spyOn(router, 'push');
    vi.advanceTimersByTime(5000);
    expect(pushSpy).toHaveBeenCalledWith('/');

    wrapper.unmount();
  });

  it('redirects immediately on button click', async () => {
    const { wrapper, router } = await mountWithApp(KickedPage);
    const pushSpy = vi.spyOn(router, 'push');

    await wrapper.find('.btnHome').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/');

    wrapper.unmount();
  });
});
