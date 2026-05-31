import { ref } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { applyVote, canVote, pollResultsSenderId, publishPollResultsToChat } from '@/utils/sessionPoll';
import { playUiSound } from '@/utils/uiSounds';

/** Poll create / vote / close actions shared by the footer poll popover. */
export function useSessionPollControls() {
  const features = useSessionFeaturesStore();
  const conference = useConferenceStore();
  const local = useLocalStore();
  const { engine } = useMediaEngine();

  const pollQuestion = ref('');
  const pollOptions = ref('Yes\nNo');

  function createPoll() {
    const opts = pollOptions.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `o${i}`, label, votes: 0 }));
    if (!pollQuestion.value.trim() || opts.length < 2) return;
    const poll = {
      id: `p${Date.now()}`,
      question: pollQuestion.value.trim(),
      options: opts,
      open: true,
    };
    features.applyPoll(poll);
    engine.sendCommand('poll', JSON.stringify(poll));
    playUiSound('success');
  }

  function vote(optionId: string) {
    if (!features.canUsePoll && !features.isHost) return;
    if (!canVote(features.myPollVote, features.activePoll)) return;
    features.myPollVote = optionId;
    const poll = applyVote(features.activePoll!, optionId);
    features.applyPoll(poll);
    engine.sendCommand('poll', JSON.stringify(poll));
    playUiSound('success');
  }

  function closePoll() {
    const poll = features.activePoll;
    /* v8 ignore next -- End poll button only renders when a poll is active */
    if (!poll) return;
    const senderId = pollResultsSenderId(local.id, engine.getLocalUserId());
    publishPollResultsToChat(conference, poll, senderId);
    features.applyPoll(null);
    engine.sendCommand('poll', JSON.stringify(null));
    playUiSound('tap');
  }

  function togglePollPanel() {
    features.togglePanel('poll');
  }

  return {
    pollQuestion,
    pollOptions,
    createPoll,
    vote,
    closePoll,
    togglePollPanel,
  };
}
