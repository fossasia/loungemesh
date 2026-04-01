import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { makeTrack } from '@/test/makeTrack';
import RemoteUsers from './RemoteUsers.vue';

describe('RemoteUsers', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders remote users and updates when positions change', async () => {
    const conference = useConferenceStore();
    conference.addUser('a');
    conference.addUser('b');
    conference.users.a.pos = { x: 1, y: 2 };
    conference.users.b.pos = { x: 3, y: 4 };
    conference.users.a.mute = true;
    conference.users.a.video = makeTrack('video', 'a');
    conference.users.a.audio = makeTrack('audio', 'a');

    const { wrapper } = await mountWithApp(RemoteUsers);
    expect(wrapper.findAll('.userContainer').length).toBe(2);
    conference.users.a.pos = { x: 10, y: 20 };
    conference.users.a.mute = false;
    await nextTick();
    wrapper.unmount();
  });

  it('renders nothing when there are no users', async () => {
    const { wrapper } = await mountWithApp(RemoteUsers);
    expect(wrapper.findAll('.userContainer').length).toBe(0);
    wrapper.unmount();
  });
});
