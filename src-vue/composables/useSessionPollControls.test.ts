import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useSessionPollControls } from './useSessionPollControls';

describe('useSessionPollControls', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('creates, votes on, and closes polls', () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const chatSpy = vi.spyOn(conference, 'sendTextMessage').mockReturnValue(true);
    const { pollQuestion, pollOptionDrafts, createPoll, vote, closePoll } = useSessionPollControls();

    pollQuestion.value = 'Lunch?';
    pollOptionDrafts.value = ['Yes', 'No'];
    createPoll();
    expect(features.activePoll?.question).toBe('Lunch?');
    expect(cmdSpy).toHaveBeenCalledWith('poll', expect.any(String));

    vote('o0');
    expect(features.myPollVote).toBe('o0');

    closePoll();
    expect(features.activePoll).toBeNull();
    expect(chatSpy).toHaveBeenCalledWith(expect.stringContaining('Poll results: Lunch?'));
    expect(cmdSpy).toHaveBeenCalledWith('poll', JSON.stringify(null));
  });

  it('skips duplicate votes and lets the host vote without poll grant', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false };
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [
        { id: 'a', label: 'A', votes: 0, voters: [] },
        { id: 'b', label: 'B', votes: 0, voters: [] },
      ],
      open: true,
    };
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { vote } = useSessionPollControls();
    vote('a');
    expect(features.myPollVote).toBe('a');
    vote('b');
    expect(cmdSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores votes without poll access', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false };
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 0 }],
      open: true,
    };
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { vote } = useSessionPollControls();
    vote('a');
    expect(features.myPollVote).toBe('');
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));
  });

  it('manages option drafts and guards invalid actions', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const {
      pollOptionDrafts,
      addPollOption,
      removePollOption,
      createPoll,
      togglePollPanel,
    } = useSessionPollControls();

    addPollOption();
    expect(pollOptionDrafts.value).toHaveLength(3);
    removePollOption(2);
    expect(pollOptionDrafts.value).toHaveLength(2);
    removePollOption(0);
    expect(pollOptionDrafts.value).toHaveLength(2);

    createPoll();
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));

    togglePollPanel();
    expect(features.panel).toBe('poll');
  });

  it('skips voting when no participant id is available', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('');
    features.setHost('host');
    features.setRoomDefault('poll', true);
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 0, voters: [] }],
      open: true,
    };
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue(undefined);
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { vote } = useSessionPollControls();
    vote('a');
    expect(features.myPollVote).toBe('');
    expect(cmdSpy).not.toHaveBeenCalledWith('poll', expect.any(String));
  });

  it('still closes when chat publish fails', () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    vi.spyOn(conference, 'sendTextMessage').mockReturnValue(false);
    features.activePoll = {
      id: 'p1',
      question: 'Tea?',
      options: [{ id: 'a', label: 'Yes', votes: 1 }],
      open: true,
    };
    const { closePoll } = useSessionPollControls();
    closePoll();
    expect(features.activePoll).toBeNull();
    expect(conference.messages).toHaveLength(0);
  });
});
