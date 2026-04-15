import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { makeTrack } from '@/test/makeTrack';
import RemoteUser from './RemoteUser.vue';

describe('RemoteUser', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('defaults position when user pos is missing', async () => {
    const conference = useConferenceStore();
    conference.addUser('u0', { _displayName: 'Anon' } as never);
    conference.users.u0.pos = undefined as never;
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u0' } });
    expect((wrapper.element as HTMLElement).style.left).toBe('0px');
    wrapper.unmount();
  });

  it('shows speaking ring and desktop video', async () => {
    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Bob' } as never);
    const u = conference.users.u1;
    u.speaking = true;
    u.mute = false;
    u.pos = { x: 10, y: 20 };
    u.video = makeTrack('desktop');
    u.video.videoType = 'desktop';

    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u1' } });
    expect(wrapper.find('.speakRing.active').exists()).toBe(true);
    wrapper.unmount();
  });

  it('treats onStage string property as presenting', async () => {
    const conference = useConferenceStore();
    conference.addUser('u3', { _displayName: 'Sam' } as never);
    conference.users.u3.properties = { onStage: 'true' };
    conference.users.u3.pos = { x: 0, y: 0 };
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u3' } });
    expect(wrapper.text()).toContain('Presenting');
    wrapper.unmount();
  });

  it('renders on-stage backdrop', async () => {
    const conference = useConferenceStore();
    conference.addUser('u2', { _displayName: 'Pat' } as never);
    conference.users.u2.properties = { onStage: true };
    conference.users.u2.pos = { x: 0, y: 0 };
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u2' } });
    expect(wrapper.text()).toContain('Presenting');
    wrapper.unmount();
  });
});
