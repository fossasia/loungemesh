import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import LobbyOverlay from './LobbyOverlay.vue';

describe('LobbyOverlay', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows waiting message when lobby blocks guest', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    conference.setDisplayName('Guest');
    features.lobbyEnabled = true;
    features.localLobbyPending = true;
    const { wrapper } = await mountWithApp(LobbyOverlay);
    expect(wrapper.text()).toContain('Waiting for the host');
    wrapper.unmount();
  });

  it('hides when not blocked', async () => {
    const { wrapper } = await mountWithApp(LobbyOverlay);
    expect(wrapper.find('.lobby').exists()).toBe(false);
    wrapper.unmount();
  });
});
