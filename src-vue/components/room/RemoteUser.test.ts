import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { makeTrack } from '@/test/makeTrack';
import RemoteUser from './RemoteUser.vue';

describe('RemoteUser', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('positions user without explicit coordinates', async () => {
    const conference = useConferenceStore();
    conference.addUser('nopos');
    delete conference.users.nopos.pos;
    conference.users.nopos.video = makeTrack('video');
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'nopos' } });
    expect(wrapper.find('.userContainer').attributes('style')).toContain('left: 0px');
    wrapper.unmount();
  });

  it('renders camera video when not desktop', async () => {
    const conference = useConferenceStore();
    conference.addUser('cam');
    conference.users.cam.pos = { x: 1, y: 2 };
    conference.users.cam.video = makeTrack('video');
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'cam' } });
    expect(wrapper.find('.userContainer').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders desktop video and mute indicator', async () => {
    const conference = useConferenceStore();
    conference.addUser('desk');
    conference.users.desk.pos = { x: 0, y: 0 };
    conference.users.desk.video = makeTrack('desktop');
    conference.users.desk.mute = true;
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'desk' } });
    expect(wrapper.find('.userContainer').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders nothing for unknown user ids', async () => {
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'missing' } });
    expect(wrapper.find('.userContainer').exists()).toBe(false);
    wrapper.unmount();
  });
});
