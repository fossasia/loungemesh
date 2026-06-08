import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
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

  it('shows speaking highlight on camera video', async () => {
    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Bob' } as never);
    const u = conference.users.u1;
    u.speaking = true;
    u.mute = false;
    u.pos = { x: 10, y: 20 };
    u.video = makeTrack('video');

    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u1' } });
    expect(wrapper.find('video.speaking').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows speaking highlight on avatar when camera is off', async () => {
    const conference = useConferenceStore();
    conference.addUser('u-avatar', { _displayName: 'Cam Off' } as never);
    const u = conference.users['u-avatar'];
    u.speaking = true;
    u.mute = false;
    u.pos = { x: 0, y: 0 };

    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u-avatar' } });
    expect(wrapper.find('.videoContainer.speaking').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows avatar tile ring when remote camera is off', async () => {
    const conference = useConferenceStore();
    conference.addUser('u-ring', { _displayName: 'No Cam' } as never);
    conference.users['u-ring'].pos = { x: 0, y: 0 };
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u-ring' } });
    expect(wrapper.find('.videoContainer.avatarTile').exists()).toBe(true);
    expect(wrapper.find('video.remoteVideo').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows avatar when remote camera is off', async () => {
    const conference = useConferenceStore();
    conference.addUser('u-muted-flag', { _displayName: 'Muted Flag' } as never);
    conference.users['u-muted-flag'].pos = { x: 0, y: 0 };

    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u-muted-flag' } });
    expect(wrapper.find('video.remoteVideo').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'UserBackdrop' }).exists()).toBe(true);
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

  it('shows reaction emoji and raised hand', async () => {
    vi.useFakeTimers();
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    conference.addUser('u4', { _displayName: 'Lee' } as never);
    conference.users.u4.pos = { x: 0, y: 0 };
    conference.users.u4.properties = { handRaised: true };
    features.setReaction('u4', '🎉');
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u4' } });
    expect(wrapper.find('.floatReact').text()).toBe('🎉');
    expect(wrapper.find('.handBadge').exists()).toBe(true);
    vi.advanceTimersByTime(2500);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.floatReact').exists()).toBe(false);
    expect(wrapper.find('.handBadge').exists()).toBe(true);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('falls back to a default name when no display name is known', async () => {
    const conference = useConferenceStore();
    conference.addUser('u-noname');
    conference.users['u-noname'].pos = { x: 0, y: 0 };
    const { wrapper } = await mountWithApp(RemoteUser, { props: { id: 'u-noname' } });
    expect(wrapper.text()).toContain('Friendly Sphere');
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
