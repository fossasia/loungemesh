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
    const { pollQuestion, pollOptions, createPoll, vote, closePoll } = useSessionPollControls();

    pollQuestion.value = 'Lunch?';
    pollOptions.value = 'Yes\nNo';
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

  it('ignores votes without poll access', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
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
