import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { makeTrack } from '@/test/makeTrack';
import SphereGridOverlay from './SphereGridOverlay.vue';

describe('SphereGridOverlay', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows local and in-sphere remotes, then closes', async () => {
    const local = useLocalStore();
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    local.setMyID('me');
    local.pos = { x: 0, y: 0 };
    local.cameraOff = true;
    conference.displayName = 'Ada';
    conference.addUser('near', { _displayName: 'Near' } as never);
    conference.users.near.pos = { x: 10, y: 10 };
    conference.users.near.video = makeTrack('video');
    conference.addUser('far', { _displayName: 'Far' } as never);
    conference.users.far.pos = { x: 3000, y: 3000 };
    features.gridView = true;

    const { wrapper } = await mountWithApp(SphereGridOverlay);
    expect(wrapper.text()).toContain('Ada');
    expect(wrapper.text()).toContain('Near');
    expect(wrapper.text()).not.toContain('Far');
    await wrapper.find('[aria-label="Close grid view"]').trigger('click');
    expect(features.gridView).toBe(false);
    wrapper.unmount();
  });

  it('renders local camera and remote avatar fallbacks', async () => {
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('me');
    local.pos = { x: 0, y: 0 };
    local.cameraOff = false;
    local.video = makeTrack('video');
    conference.addUser('near', { _displayName: 'Near' } as never);
    conference.users.near.pos = { x: 8, y: 8 };
    conference.users.near.properties = { avatarUrl: 'https://example.test/a.png' };

    const { wrapper } = await mountWithApp(SphereGridOverlay);
    expect(wrapper.findComponent({ name: 'GridTileVideo' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'UserBackdrop' }).exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders remote cameras with GridTileVideo instead of the bubble player', async () => {
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('me');
    local.pos = { x: 0, y: 0 };
    local.cameraOff = false;
    local.video = makeTrack('video');
    conference.addUser('near', { _displayName: 'Near' } as never);
    conference.users.near.pos = { x: 8, y: 8 };
    conference.users.near.video = makeTrack('video');
    const { wrapper } = await mountWithApp(SphereGridOverlay);
    expect(wrapper.findAllComponents({ name: 'GridTileVideo' })).toHaveLength(2);
    expect(wrapper.findComponent({ name: 'RemoteVideo' }).exists()).toBe(false);
    wrapper.unmount();
  });

  it('includes a far presenter and ignores non-string avatars', async () => {
    const local = useLocalStore();
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    local.setMyID('');
    local.pos = { x: 0, y: 0 };
    conference.displayName = '';
    conference.addUser('stage', { _displayName: 'Host' } as never);
    conference.users.stage.pos = { x: 4000, y: 4000 };
    conference.users.stage.properties = { avatarUrl: 1 };
    features.stageOccupantId = 'stage';
    const { wrapper } = await mountWithApp(SphereGridOverlay);
    expect(wrapper.text()).toContain('You');
    expect(wrapper.text()).toContain('Host');
    wrapper.unmount();
  });
});
