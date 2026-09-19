import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import ReconnectingBanner from './ReconnectingBanner.vue';

describe('ReconnectingBanner', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('hides while the conference is not interrupted', async () => {
    const conference = useConferenceStore();
    conference.isJoined = true;
    const { wrapper } = await mountWithApp(ReconnectingBanner);
    expect(wrapper.find('.reconnectingBanner').exists()).toBe(false);
    wrapper.unmount();
  });

  it('hides while interrupted but not yet joined', async () => {
    const conference = useConferenceStore();
    conference.connectionInterrupted = true;
    conference.isJoined = false;
    const { wrapper } = await mountWithApp(ReconnectingBanner);
    expect(wrapper.find('.reconnectingBanner').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows a live status when the bridge drops mid-session', async () => {
    const conference = useConferenceStore();
    conference.isJoined = true;
    conference.connectionInterrupted = true;
    const { wrapper } = await mountWithApp(ReconnectingBanner);
    const banner = wrapper.find('.reconnectingBanner');
    expect(banner.exists()).toBe(true);
    expect(banner.attributes('role')).toBe('status');
    expect(banner.attributes('aria-live')).toBe('polite');
    expect(banner.text()).toContain('Reconnecting');
    wrapper.unmount();
  });
});
