import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import SessionFeaturePanels from './SessionFeaturePanels.vue';

describe('SessionFeaturePanels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  it('syncs notes for host', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await flushPromises();
    const ta = wrapper.find('.notesTa');
    await ta.setValue('shared text');
    vi.advanceTimersByTime(500);
    expect(features.sharedNotes).toBe('shared text');
    wrapper.unmount();
  });

  it('runs moderator flows for host', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    conference.addUser('host', { _displayName: 'Host' } as never);
    conference.addUser('peer', { _displayName: 'Peer' } as never);
    features.panel = 'moderator';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await flushPromises();
    features.lobbyWaiting = [{ id: 'w1', name: 'Waiter' }];
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await wrapper.find('.lobbyToggle input').setValue(true);
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('"enabled":true'));
    await checkboxes[checkboxes.length - 1].setValue(true);
    await wrapper.find('.lobbyRow .pill').trigger('click');
    const peerCard = wrapper
      .findAll('.participantCard')
      .find((row) => row.text().includes('Peer'));
    expect(peerCard).toBeTruthy();
    await peerCard!.find('.pill.subtle').trigger('click');
    await peerCard!.find('.pill.warn').trigger('click');
    const peerGrant = peerCard!.find('.grantCheck input');
    await peerGrant.setValue(true);
    expect(cmdSpy).toHaveBeenCalledWith('access', expect.stringContaining('"userId":"peer"'));
    wrapper.unmount();
  });

  it('hides menu card when whiteboard panel is active', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    expect(wrapper.find('.featureCard').exists()).toBe(false);
    wrapper.unmount();
  });

  it('syncs remote notes while the notes panel is open when not editing', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'notes';
    features.sharedNotes = 'local';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    features.sharedNotes = 'remote';
    await nextTick();
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('remote');
    wrapper.unmount();
  });

  it('does not push notes when the user cannot edit', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    features.panel = 'notes';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    const ta = wrapper.find('.notesTa').element as HTMLTextAreaElement;
    ta.value = 'blocked';
    await wrapper.find('.notesTa').trigger('input');
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.any(String));
    wrapper.unmount();
  });

  it('does not overwrite notes draft while the user is typing', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'notes';
    features.sharedNotes = 'initial';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await wrapper.find('.notesTa').setValue('typing');
    features.sharedNotes = 'remote overwrite';
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('typing');
    wrapper.unmount();
  });

  it('does not publish stale notes when the user only focuses the textarea', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    features.sharedNotes = 'latest shared';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await wrapper.find('.notesTa').trigger('focus');
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.any(String));
    wrapper.unmount();
  });

  it('applies remote notes while focused without local edits', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'notes';
    features.sharedNotes = 'before';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await wrapper.find('.notesTa').trigger('focus');
    features.sharedNotes = 'after';
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('after');
    wrapper.unmount();
  });

  it('does not publish when remote notes changed during a local edit', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    features.sharedNotes = 'original';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await wrapper.find('.notesTa').setValue('original tweak');
    features.sharedNotes = 'remote update';
    await wrapper.find('.notesTa').trigger('blur');
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.stringContaining('tweak'));
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('remote update');
    wrapper.unmount();
  });

  it('syncs notes and whiteboard access toggles', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'moderator';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[0].setValue(true);
    await checkboxes[1].setValue(true);
    expect(cmdSpy).toHaveBeenCalledWith(
      'access',
      expect.stringContaining('"notes":true'),
    );
    expect(cmdSpy).toHaveBeenCalledWith(
      'access',
      expect.stringContaining('"whiteboard":true'),
    );
    wrapper.unmount();
  });

  it('shows moderator panel without a lobby queue', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'moderator';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    expect(wrapper.text()).toContain('Per participant');
    expect(wrapper.find('.lobbyBlock').exists()).toBe(false);
    wrapper.unmount();
  });

  it('syncs notes draft when remote notes change', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'poll';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    features.sharedNotes = 'updated remotely';
    await flushPromises();
    features.panel = 'notes';
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe(
      'updated remotely',
    );
    wrapper.unmount();
  });

  it('uses an empty title for unknown panels', async () => {
    const features = useSessionFeaturesStore();
    (features as { panel: string }).panel = 'unknown';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    expect(wrapper.find('.title').text()).toBe('');
    wrapper.unmount();
  });

  it('closes from the panel header', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'moderator';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    await wrapper.find('.close').trigger('click');
    expect(features.panel).toBe('');
    wrapper.unmount();
  });

  it('hides menu card for reactions and poll panels', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'reactions';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    expect(wrapper.find('.featureCard').exists()).toBe(false);
    features.panel = 'poll';
    await flushPromises();
    expect(wrapper.find('.featureCard').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows participant id when display name is missing', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    conference.addUser('plain-id');
    features.panel = 'moderator';
    const { wrapper } = await mountWithApp(SessionFeaturePanels);
    expect(wrapper.text()).toContain('plain-id');
    wrapper.unmount();
  });
});
