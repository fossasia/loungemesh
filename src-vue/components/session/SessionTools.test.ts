import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import SessionTools from './SessionTools.vue';

describe('SessionTools', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens reactions popover above the button', async () => {
    const features = useSessionFeaturesStore();
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    expect(features.panel).toBe('reactions');
    expect(wrapper.find('.reactionsPop').exists()).toBe(true);
    await wrapper.find('.reactionsPop').trigger('pointerdown');
    wrapper.unmount();
  });

  it('sends a reaction from the popover', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('local-1');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    await wrapper.find('.reactionsPop .emojiBtn').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('react', expect.any(String));
    expect(features.panel).toBe('');
    wrapper.unmount();
  });

  it('toggles panels and hand raise for host', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('local-1');
    features.setHost('local-1');
    conference.addUser('local-1');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('local-1');
    const propSpy = vi.spyOn(getMediaEngineInstance(), 'setLocalParticipantProperty');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Raise hand"]').trigger('click');
    expect(features.handRaised).toBe(true);
    expect(propSpy).toHaveBeenCalledWith('handRaised', true);
    expect(cmdSpy).toHaveBeenCalledWith('hand', JSON.stringify({ id: 'local-1', raised: true }));
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    expect(features.panel).toBe('poll');
    await wrapper.find('[aria-label="Shared notes"]').trigger('click');
    expect(features.panel).toBe('notes');
    await wrapper.find('[aria-label="Whiteboard"]').trigger('click');
    expect(features.panel).toBe('whiteboard');
    wrapper.unmount();
  });

  it('shows notes and whiteboard for host while alone before host sync', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('solo-host');
    features.resetHostForJoin();
    const { wrapper } = await mountWithApp(SessionTools);
    expect(wrapper.find('[aria-label="Shared notes"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Whiteboard"]').exists()).toBe(true);
    await wrapper.find('[aria-label="Shared notes"]').trigger('click');
    expect(features.panel).toBe('notes');
    wrapper.unmount();
  });

  it('toggles poll panel open and closed', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('u1');
    features.setRoomDefault('poll', true);
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    expect(features.panel).toBe('poll');
    expect(wrapper.find('.pollPop').exists()).toBe(true);
    await wrapper.find('.pollPop').trigger('pointerdown');
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    expect(features.panel).toBe('');
    wrapper.unmount();
  });

  it('creates and ends polls from the popover', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    vi.spyOn(conference, 'sendTextMessage').mockReturnValue(true);
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    await wrapper.find('.pollPop .field').setValue('Snack?');
    await wrapper.find('.pollPop .ta').setValue('Yes\nNo');
    await wrapper.find('.pollPop .action').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('poll', expect.any(String));
    await wrapper.find('.pollPop .action.subtle').trigger('click');
    expect(features.activePoll).toBeNull();
    wrapper.unmount();
  });

  it('votes on an active poll and shows guest hint', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('voter');
    features.setHost('host');
    features.setRoomDefault('poll', true);
    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [
        { id: 'a', label: 'Yes', votes: 0 },
        { id: 'b', label: 'No', votes: 0 },
      ],
      open: true,
    };
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    await wrapper.find('.pollPop .opt').trigger('click');
    expect(features.myPollVote).toBe('a');

    features.activePoll = null;
    features.panel = '';
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    expect(wrapper.find('.pollPop').text()).toContain('Waiting for the host');
    wrapper.unmount();
  });

  it('shows poll access hint when the user cannot vote', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [{ id: 'a', label: 'Yes', votes: 0 }],
      open: true,
    };
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    expect(wrapper.find('.pollPop').text()).toContain('has not granted poll access');
    wrapper.unmount();
  });

  it('skips invalid poll creation and duplicate votes', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Poll"]').trigger('click');
    await wrapper.find('.pollPop .action').trigger('click');
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));

    await wrapper.find('.pollPop .ta').setValue('Only');
    await wrapper.find('.pollPop .action').trigger('click');
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));

    wrapper.unmount();

    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 0 }],
      open: true,
    };
    features.myPollVote = 'a';
    features.panel = 'poll';
    const { wrapper: voteWrapper } = await mountWithApp(SessionTools);
    const calls = cmdSpy.mock.calls.length;
    await voteWrapper.find('.pollPop .opt').trigger('click');
    expect(cmdSpy.mock.calls.length).toBe(calls);
    voteWrapper.unmount();
  });

  it('opens reactions from another active panel', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'poll';
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    expect(features.panel).toBe('reactions');
    wrapper.unmount();
  });

  it('closes the reactions popover when toggled again', async () => {
    const features = useSessionFeaturesStore();
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    expect(features.panel).toBe('');
    wrapper.unmount();
  });

  it('blocks notes and whiteboard for guests without access', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    const { wrapper } = await mountWithApp(SessionTools);
    expect(wrapper.find('[aria-label="Shared notes"]').exists()).toBe(true);
    await wrapper.find('[aria-label="Shared notes"]').trigger('click');
    expect(features.panel).toBe('');
    await wrapper.find('[aria-label="Whiteboard"]').trigger('click');
    expect(features.panel).toBe('');
    wrapper.unmount();
  });

  it('sends a reaction using the engine user id', async () => {
    const local = useLocalStore();
    local.setMyID('');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('engine-user');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    await wrapper.find('.reactionsPop .emojiBtn').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('react', expect.stringContaining('"id":"engine-user"'));
    wrapper.unmount();
  });

  it('ignores reactions when no local id is available', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue(undefined);
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Reactions"]').trigger('click');
    await wrapper.find('.reactionsPop .emojiBtn').trigger('click');
    expect(cmdSpy).not.toHaveBeenCalled();
    expect(features.panel).toBe('reactions');
    wrapper.unmount();
  });

  it('raises hand using the engine user id when local id is unset', async () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('engine-user');
    const propSpy = vi.spyOn(getMediaEngineInstance(), 'setLocalParticipantProperty');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Raise hand"]').trigger('click');
    expect(propSpy).toHaveBeenCalledWith('handRaised', true);
    expect(cmdSpy).toHaveBeenCalledWith('hand', JSON.stringify({ id: 'engine-user', raised: true }));
    expect(features.handRaised).toBe(true);
    expect(conference.users['engine-user']).toBeUndefined();
    wrapper.unmount();
  });

  it('ignores hand toggle when no participant id is available', async () => {
    const local = useLocalStore();
    local.setMyID('');
    const propSpy = vi.spyOn(getMediaEngineInstance(), 'setLocalParticipantProperty');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue(undefined);
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Raise hand"]').trigger('click');
    expect(propSpy).not.toHaveBeenCalled();
    expect(cmdSpy).not.toHaveBeenCalled();
    expect(useSessionFeaturesStore().handRaised).toBe(false);
    wrapper.unmount();
  });

  it('raises hand without a conference user record', async () => {
    const local = useLocalStore();
    local.setMyID('solo');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('solo');
    const { wrapper } = await mountWithApp(SessionTools);
    await wrapper.find('[aria-label="Raise hand"]').trigger('click');
    expect(useSessionFeaturesStore().handRaised).toBe(true);
    wrapper.unmount();
  });
});
