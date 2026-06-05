import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import PollPanel from './PollPanel.vue';

describe('PollPanel', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('creates and ends polls for the host', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    vi.spyOn(conference, 'sendTextMessage').mockReturnValue(true);
    const { wrapper } = await mountWithApp(PollPanel);

    await wrapper.find('#poll-question').setValue('Snack?');
    const optionFields = wrapper.findAll('.optionField');
    await optionFields[0].setValue('Yes');
    await optionFields[1].setValue('No');
    await wrapper.find('.primaryBtn').trigger('click');
    expect(features.activePoll?.question).toBe('Snack?');
    expect(cmdSpy).toHaveBeenCalledWith('poll', expect.any(String));

    await wrapper.find('.secondaryBtn').trigger('click');
    expect(features.activePoll).toBeNull();
    wrapper.unmount();
  });

  it('uses plural vote copy for multiple ballots', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('voter');
    features.setHost('host');
    features.setRoomDefault('poll', true);
    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [
        { id: 'a', label: 'Yes', votes: 1, voters: ['u1'] },
        { id: 'b', label: 'No', votes: 1, voters: ['u2'] },
      ],
      open: true,
    };
    const { wrapper } = await mountWithApp(PollPanel);
    expect(wrapper.text()).toContain('2 votes');
    wrapper.unmount();
  });

  it('uses singular vote copy for a single ballot', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('voter');
    features.setHost('host');
    features.setRoomDefault('poll', true);
    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [{ id: 'a', label: 'Yes', votes: 1, voters: ['other'] }],
      open: true,
    };
    const { wrapper } = await mountWithApp(PollPanel);
    expect(wrapper.text()).toContain('1 vote');
    expect(wrapper.text()).not.toContain('1 votes');
    wrapper.unmount();
  });

  it('shows results without hints when voting is closed', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('voter');
    features.setHost('host');
    features.setRoomDefault('poll', true);
    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [{ id: 'a', label: 'Yes', votes: 1, voters: ['other'] }],
      open: false,
    };
    const { wrapper } = await mountWithApp(PollPanel);
    expect(wrapper.text()).toContain('Snack?');
    expect(wrapper.text()).not.toContain('Choose an option below');
    expect(wrapper.text()).not.toContain('You voted');
    wrapper.unmount();
  });

  it('prompts guests to choose an option before voting', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('voter');
    features.setHost('host');
    features.setRoomDefault('poll', true);
    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [
        { id: 'a', label: 'Yes', votes: 0, voters: [] },
        { id: 'b', label: 'No', votes: 0, voters: [] },
      ],
      open: true,
    };
    const { wrapper } = await mountWithApp(PollPanel);
    expect(wrapper.text()).toContain('Choose an option below');
    wrapper.unmount();
  });

  it('votes on an active poll and shows waiting state for guests', async () => {
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
    const { wrapper } = await mountWithApp(PollPanel);
    await wrapper.find('.resultRow').trigger('click');
    expect(features.myPollVote).toBe('a');
    expect(wrapper.text()).toContain('You voted');

    features.activePoll = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Waiting for the host');
    wrapper.unmount();
  });

  it('shows poll access hints for guests without access', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    const { wrapper } = await mountWithApp(PollPanel);
    expect(wrapper.text()).toContain('Ask the host for poll access');

    features.activePoll = {
      id: 'p1',
      question: 'Snack?',
      options: [{ id: 'a', label: 'Yes', votes: 2 }],
      open: true,
    };
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('has not granted poll access');
    expect(wrapper.text()).toContain('Snack?');
    wrapper.unmount();
  });

  it('skips invalid poll creation and duplicate votes', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(PollPanel);

    expect(wrapper.find('.primaryBtn').attributes('disabled')).toBeDefined();
    await wrapper.find('.primaryBtn').trigger('click');
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));

    await wrapper.findAll('.optionField')[0].setValue('Only');
    await wrapper.findAll('.optionField')[1].setValue('');
    await wrapper.find('.primaryBtn').trigger('click');
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));

    wrapper.unmount();

    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 0 }],
      open: true,
    };
    features.myPollVote = 'a';
    const { wrapper: voteWrapper } = await mountWithApp(PollPanel);
    const calls = cmdSpy.mock.calls.length;
    await voteWrapper.find('.resultRow').trigger('click');
    expect(cmdSpy.mock.calls.length).toBe(calls);
    voteWrapper.unmount();
  });

  it('adds and removes option drafts', async () => {
    const local = useLocalStore();
    local.setMyID('host');
    useSessionFeaturesStore().setHost('host');
    const { wrapper } = await mountWithApp(PollPanel);

    await wrapper.find('.textBtn').trigger('click');
    expect(wrapper.findAll('.optionField')).toHaveLength(3);

    const removeButtons = wrapper.findAll('.iconBtn');
    await removeButtons[removeButtons.length - 1].trigger('click');
    expect(wrapper.findAll('.optionField')).toHaveLength(2);

    const disabledRemove = wrapper.find('.iconBtn');
    expect(disabledRemove.attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
