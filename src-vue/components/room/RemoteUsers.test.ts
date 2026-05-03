import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { makeTrack } from '@/test/makeTrack';
import RemoteUsers from './RemoteUsers.vue';

describe('RemoteUsers', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders remote users and updates when positions change', async () => {
    const conference = useConferenceStore();
    conference.addUser('a');
    conference.addUser('b');
    conference.updateUserPosition('a', { x: 1, y: 2 });
    conference.updateUserPosition('b', { x: 3, y: 4 });
    conference.patchUser('a', { mute: true, video: makeTrack('video', 'a'), audio: makeTrack('audio', 'a') });

    const { wrapper } = await mountWithApp(RemoteUsers);
    expect(wrapper.findAll('.userContainer').length).toBe(2);
    conference.updateUserPosition('a', { x: 10, y: 20 });
    conference.patchUser('a', { mute: false });
    await nextTick();
    wrapper.unmount();
  });

  it('filters users in lobby mode until approved', async () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.hostId = 'host';
    features.lobbyApproved.host = true;
    conference.addUser('host');
    conference.addUser('guest');
    conference.updateUserPosition('host', { x: 0, y: 0 });
    conference.updateUserPosition('guest', { x: 1, y: 1 });

    const { wrapper } = await mountWithApp(RemoteUsers);
    expect(wrapper.findAll('.userContainer').length).toBe(1);
    features.approveLobby('guest');
    await nextTick();
    expect(wrapper.findAll('.userContainer').length).toBe(2);
    wrapper.unmount();
  });

  it('renders nothing when there are no users', async () => {
    const { wrapper } = await mountWithApp(RemoteUsers);
    expect(wrapper.findAll('.userContainer').length).toBe(0);
    wrapper.unmount();
  });
});
