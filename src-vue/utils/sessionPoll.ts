import type { ActivePoll } from '@/stores/sessionFeaturesStore';
import { createChatMessage } from '@/utils/chatMessage';

export function pollResultsSenderId(localId: string, engineUserId?: string): string {
  return localId || engineUserId || '';
}

export type PollChatConference = {
  sendTextMessage: (text: string) => boolean;
  appendChatMessage: (msg: ReturnType<typeof createChatMessage>) => void;
};

/** Format final poll tallies for the room chat. */
export function formatPollResultsMessage(poll: ActivePoll): string {
  const lines = [`Poll results: ${poll.question}`];
  const sorted = [...poll.options].sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
  for (const opt of sorted) {
    const voteLabel = opt.votes === 1 ? 'vote' : 'votes';
    lines.push(`${opt.label}: ${opt.votes} ${voteLabel}`);
  }
  return lines.join('\n');
}

/** Broadcast poll results to everyone via Jitsi chat. */
export function publishPollResultsToChat(
  conference: PollChatConference,
  poll: ActivePoll,
  senderId: string,
): boolean {
  const text = formatPollResultsMessage(poll);
  const delivered = conference.sendTextMessage(text);
  if (delivered) {
    conference.appendChatMessage(createChatMessage(senderId, text, -Date.now()));
  }
  return delivered;
}

export function canVote(myPollVote: string, activePoll: ActivePoll | null): boolean {
  return !myPollVote && !!activePoll?.open;
}

export function applyVote(
  poll: ActivePoll,
  optionId: string,
): ActivePoll {
  const next = { ...poll, options: poll.options.map((o) => ({ ...o })) };
  for (const o of next.options) {
    if (o.id === optionId) o.votes += 1;
  }
  return next;
}
