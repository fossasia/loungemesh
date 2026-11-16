import { computed, ref } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore, type PollRequest } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import {
  applyVote,
  canCreatePoll,
  canVote,
  pollResultsSenderId,
  publishPollResultsToChat,
} from '@/utils/sessionPoll';
import { playUiSound } from '@/utils/uiSounds';

/** Poll create / vote / close actions shared by the poll panel. */
export function useSessionPollControls() {
  const features = useSessionFeaturesStore();
  const conference = useConferenceStore();
  const local = useLocalStore();
  const { engine } = useMediaEngine();

  const pollQuestion = ref('');
  const pollOptionDrafts = ref(['Yes', 'No']);

  const createReady = computed(() => canCreatePoll(pollQuestion.value, pollOptionDrafts.value));

  function addPollOption() {
    pollOptionDrafts.value.push('');
  }

  function removePollOption(index: number) {
    if (pollOptionDrafts.value.length <= 2) return;
    pollOptionDrafts.value.splice(index, 1);
  }

  function createPoll() {
    const opts = pollOptionDrafts.value
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `o${i}`, label, votes: 0, voters: [] as string[] }));
    if (!canCreatePoll(pollQuestion.value, pollOptionDrafts.value)) return;
    const poll = {
      id: `p${Date.now()}`,
      question: pollQuestion.value.trim(),
      options: opts,
      open: true,
    };
    features.applyPoll(poll, true);
    engine.sendCommand('poll', JSON.stringify(poll));
    playUiSound('success');
  }

  function requestPoll() {
    if (!canCreatePoll(pollQuestion.value, pollOptionDrafts.value)) return;
    const opts = pollOptionDrafts.value
      .map((l) => l.trim())
      .filter(Boolean);
    const id = `pr${Date.now()}`;
    const req: PollRequest = {
      id,
      question: pollQuestion.value.trim(),
      options: opts,
      requesterId: pollResultsSenderId(local.id, engine.getLocalUserId()),
      requesterName: conference.displayName || 'Participant',
      createdAt: Date.now(),
    };
    features.addPollRequest(req);
    features.myPendingPollRequestId = id;
    features.pollRequestNotice = '';
    engine.sendCommand('poll_req', JSON.stringify({ action: 'create', request: req }));
    playUiSound('success');
    pollQuestion.value = '';
    pollOptionDrafts.value = ['Yes', 'No'];
  }

  function cancelPollRequest(requestId?: string) {
    const id = requestId || features.myPendingPollRequestId;
    if (!id) return;
    features.removePollRequest(id);
    engine.sendCommand('poll_req', JSON.stringify({ action: 'cancel', requestId: id }));
    playUiSound('tap');
  }

  function approvePollRequest(request: PollRequest) {
    if (!features.canManagePoll) return;
    const opts = request.options.map((label, i) => ({
      id: `o${i}`,
      label,
      votes: 0,
      voters: [] as string[],
    }));
    const poll = {
      id: `p${Date.now()}`,
      question: request.question,
      options: opts,
      open: true,
    };
    features.removePollRequest(request.id);
    features.applyPoll(poll, true);
    engine.sendCommand('poll', JSON.stringify(poll));
    engine.sendCommand('poll_req', JSON.stringify({ action: 'approve', requestId: request.id }));
    playUiSound('success');
  }

  function rejectPollRequest(requestId: string) {
    if (!features.canManagePoll) return;
    features.removePollRequest(requestId);
    engine.sendCommand('poll_req', JSON.stringify({ action: 'reject', requestId }));
    playUiSound('tap');
  }

  function vote(optionId: string) {
    if (!features.canUsePoll && !features.isHost && !features.isModerator && !features.eventyayMeet) return;
    if (!canVote(features.myPollVote, features.activePoll)) return;
    const voterId = pollResultsSenderId(local.id, engine.getLocalUserId());
    if (!voterId) return;
    features.myPollVote = optionId;
    const poll = applyVote(features.activePoll!, optionId, voterId);
    features.applyPoll(poll, true);
    engine.sendCommand('poll', JSON.stringify(poll));
    playUiSound('success');
  }

  function closePoll() {
    const poll = features.activePoll;
    /* v8 ignore next -- End poll button only renders when a poll is active */
    if (!poll) return;
    const senderId = pollResultsSenderId(local.id, engine.getLocalUserId());
    publishPollResultsToChat(conference, poll, senderId);
    features.applyPoll(null, true);
    engine.sendCommand('poll', JSON.stringify(null));
    playUiSound('tap');
  }

  function togglePollPanel() {
    features.togglePanel('poll');
  }

  return {
    pollQuestion,
    pollOptionDrafts,
    createReady,
    addPollOption,
    removePollOption,
    createPoll,
    requestPoll,
    cancelPollRequest,
    approvePollRequest,
    rejectPollRequest,
    vote,
    closePoll,
    togglePollPanel,
  };
}
