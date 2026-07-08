import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import { nextTick } from 'vue';
import SharedScreens from './SharedScreens.vue';
import ExpandedScreenshare from './ExpandedScreenshare.vue';

describe('SharedScreens', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders nothing when no screenshares are active', async () => {
    const { wrapper } = await mountWithApp(SharedScreens);
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders screenshare list when screenshares are active', async () => {
    const local = useLocalStore();
    local.id = 'me';
    local.screenshare = makeTrack('desktop');

    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Bob' });
    conference.users.u1.screenshare = makeTrack('desktop');

    const { wrapper } = await mountWithApp(SharedScreens);
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(true);
    expect(wrapper.text()).toContain('Your Screen');
    expect(wrapper.text()).toContain("Bob's Screen");
    expect(wrapper.find('.screenshareItem.is-local').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders local screenshare with fallback ID when local.id is empty', async () => {
    const local = useLocalStore();
    local.id = '';
    local.screenshare = makeTrack('desktop');
    const { wrapper } = await mountWithApp(SharedScreens);
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(true);
    expect(wrapper.text()).toContain('Your Screen');
    wrapper.unmount();
  });

  it('renders remote screenshare with fallback name when user has no display name', async () => {
    const conference = useConferenceStore();
    conference.addUser('u2');
    conference.users.u2.user = undefined; // Force fallback display name
    conference.users.u2.screenshare = makeTrack('desktop');
    const { wrapper } = await mountWithApp(SharedScreens);
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(true);
    expect(wrapper.text()).toContain("Friendly Sphere's Screen");
    wrapper.unmount();
  });

  it('does not include remote users without active screenshare in the list', async () => {
    const conference = useConferenceStore();
    conference.addUser('u3', { _displayName: 'Charlie' });
    const { wrapper } = await mountWithApp(SharedScreens);
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(false);
    wrapper.unmount();
  });

  it('toggles collapse state when header is clicked', async () => {
    vi.useFakeTimers();
    const local = useLocalStore();
    local.screenshare = makeTrack('desktop');
    const { wrapper } = await mountWithApp(SharedScreens);

    expect(wrapper.find('.sharedScreensBox').classes()).not.toContain('collapsed');
    expect(wrapper.find('.boxContent').exists()).toBe(true);

    await wrapper.find('.boxHeader').trigger('click');
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.find('.sharedScreensBox').classes()).toContain('collapsed');
    expect(wrapper.find('.boxContent').exists()).toBe(false);

    await wrapper.find('.boxHeader').trigger('click');
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.find('.sharedScreensBox').classes()).not.toContain('collapsed');
    expect(wrapper.find('.boxContent').exists()).toBe(true);

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('pops out a screenshare and minimizes it back', async () => {
    vi.useFakeTimers();
    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Bob' });
    conference.users.u1.screenshare = makeTrack('desktop');
    conference.users.u1.screenshareAudio = makeTrack('audio');

    const { wrapper } = await mountWithApp(SharedScreens);

    expect(wrapper.find('.screenshareItem').exists()).toBe(true);
    expect(wrapper.findComponent(ExpandedScreenshare).exists()).toBe(false);

    await wrapper.find('.expandButton').trigger('click');
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(wrapper.find('.screenshareItem').exists()).toBe(false);
    expect(wrapper.find('.emptyState').text()).toBe('All screens expanded');
    expect(wrapper.findComponent(ExpandedScreenshare).exists()).toBe(true);

    const expanded = wrapper.findComponent(ExpandedScreenshare);

    // Click audio toggle in expanded view
    const audioToggle = expanded.find('.audioToggleButton');
    expect(audioToggle.exists()).toBe(true);
    await audioToggle.trigger('click');
    expect(useLocalStore().mutedRemoteScreenshareAudios['u1']).toBe(true);

    // Trigger Drag
    const header = expanded.find('.windowHeader');
    header.element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true }),
    );
    header.element.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 150, clientY: 150, bubbles: true }),
    );
    header.element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // Trigger Resize
    const resizeHandle = expanded.find('.resizeHandle');
    resizeHandle.element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, bubbles: true }),
    );
    resizeHandle.element.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 250, bubbles: true }),
    );
    resizeHandle.element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // Trigger Window Resize
    window.dispatchEvent(new Event('resize'));

    // Emit minimize from ExpandedScreenshare
    await expanded.vm.$emit('minimize');

    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.find('.screenshareItem').exists()).toBe(true);
    expect(wrapper.findComponent(ExpandedScreenshare).exists()).toBe(false);

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('cleans up stale poppedOutIds when the streams list changes', async () => {
    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Bob' });
    conference.users.u1.screenshare = makeTrack('desktop');

    const { wrapper } = await mountWithApp(SharedScreens);

    // Expand Bob's screenshare
    await wrapper.find('.expandButton').trigger('click');
    expect(wrapper.findComponent(ExpandedScreenshare).exists()).toBe(true);

    // Add Charlie
    conference.addUser('u2', { _displayName: 'Charlie' });
    conference.users.u2.screenshare = makeTrack('desktop');
    await nextTick();

    // Stop Bob's screensharing
    conference.users.u1.screenshare = undefined;
    await nextTick();

    // Box should still exist because Charlie is sharing, but Bob's ExpandedScreenshare should be unmounted
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(true);
    expect(wrapper.findComponent(ExpandedScreenshare).exists()).toBe(false);

    wrapper.unmount();
  });

  it('toggles local preview visibility and collapses card', async () => {
    const local = useLocalStore();
    local.id = 'me';
    local.screenshare = makeTrack('desktop');

    const { wrapper } = await mountWithApp(SharedScreens);

    // Initially preview is collapsed (.videoContainer does not exist, eye icon in button)
    expect(wrapper.find('.videoContainer').exists()).toBe(false);
    expect(wrapper.find('.previewToggleButton').attributes('title')).toBe('Show preview');
    expect(wrapper.find('.sharingBadge').exists()).toBe(true);
    expect(wrapper.find('.sharingBadge').text()).toBe('Sharing');

    // Click toggle to show preview
    await wrapper.find('.previewToggleButton').trigger('click');
    expect(wrapper.find('.videoContainer').exists()).toBe(true);
    expect(wrapper.find('.previewToggleButton').attributes('title')).toBe('Hide preview');

    // Click toggle to hide preview again
    await wrapper.find('.previewToggleButton').trigger('click');
    expect(wrapper.find('.videoContainer').exists()).toBe(false);
    expect(wrapper.find('.previewToggleButton').attributes('title')).toBe('Show preview');

    wrapper.unmount();
  });

  it('filters remote screenshares based on distance unless they are presenting', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.pos = { x: 0, y: 0 };

    const conference = useConferenceStore();
    conference.addUser('far-user', { _displayName: 'Far User' });
    const user = conference.users['far-user'];
    user.screenshare = makeTrack('desktop');
    user.pos = { x: 1000, y: 1000 };

    const { wrapper } = await mountWithApp(SharedScreens);
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(false);

    // Make presenter
    features.stageOccupantId = 'far-user';
    await nextTick();
    expect(wrapper.find('.sharedScreensBox').exists()).toBe(true);

    wrapper.unmount();
  });

  it('toggles screenshare audio for local and remote streams', async () => {
    const { getMediaEngineInstance } = await import('@/services/mediaEngineSingleton');
    const engine = getMediaEngineInstance();
    const setTrackMuteMock = vi.fn();
    engine.setTrackMute = setTrackMuteMock;

    const local = useLocalStore();
    local.id = 'me';
    local.screenshare = makeTrack('desktop');
    local.screenshareAudio = makeTrack('audio');
    local.screenshareAudioMuted = false;

    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Bob' });
    conference.users.u1.screenshare = makeTrack('desktop');
    conference.users.u1.screenshareAudio = makeTrack('audio');

    const { wrapper } = await mountWithApp(SharedScreens);

    const localToggle = wrapper.find('.screenshareItem.is-local .audioToggleButton');
    expect(localToggle.exists()).toBe(true);
    await localToggle.trigger('click');
    expect(local.screenshareAudioMuted).toBe(true);

    await localToggle.trigger('click');
    expect(local.screenshareAudioMuted).toBe(false);

    const remoteToggle = wrapper.find('.screenshareItem:not(.is-local) .audioToggleButton');
    expect(remoteToggle.exists()).toBe(true);
    await remoteToggle.trigger('click');
    expect(local.mutedRemoteScreenshareAudios['u1']).toBe(true);
    expect(setTrackMuteMock).toHaveBeenCalledWith('mock-track-id', true);

    local.screenshareAudio = undefined;
    await localToggle.trigger('click');

    conference.users.u1.screenshareAudio = undefined;
    await remoteToggle.trigger('click');

    wrapper.unmount();
  });

  it('toggles screenshare audio for local expanded screenshare', async () => {
    const local = useLocalStore();
    local.id = 'me';
    local.screenshareAudio = makeTrack('audio');

    const { wrapper } = await mountWithApp(ExpandedScreenshare, {
      props: {
        id: 'local',
        name: 'You',
        track: makeTrack('desktop'),
        index: 0,
      },
    });

    const toggle = wrapper.find('.audioToggleButton');
    expect(toggle.exists()).toBe(true);
    await toggle.trigger('click');
    expect(local.screenshareAudioMuted).toBe(true);

    wrapper.unmount();
  });
});
