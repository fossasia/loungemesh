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

export function pollTotalVotes(poll: ActivePoll | null): number {
  if (!poll) return 0;
  return poll.options.reduce((sum, option) => sum + option.votes, 0);
}

export function pollOptionPercent(votes: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return Math.round((votes / totalVotes) * 100);
}

export function canCreatePoll(question: string, optionDrafts: string[]): boolean {
  const options = optionDrafts.map((line) => line.trim()).filter(Boolean);
  return !!question.trim() && options.length >= 2;
}

/** Normalize vote counts from voter lists when present. */
export function normalizePoll(poll: ActivePoll): ActivePoll {
  return {
    ...poll,
    options: poll.options.map((option) => {
      const voters = option.voters ? [...option.voters] : [];
      const votes = voters.length > 0 ? voters.length : option.votes;
      return { ...option, voters, votes };
    }),
  };
}

/** Merge remote poll updates without losing votes from concurrent voters. */
export function mergePolls(incoming: ActivePoll, current: ActivePoll | null): ActivePoll {
  const next = normalizePoll(incoming);
  if (!current || current.id !== next.id) return next;
  const prev = normalizePoll(current);

  const tracksVoters = [...next.options, ...prev.options].some((option) => option.voters.length > 0);

  if (tracksVoters) {
    const voterChoice = new Map<string, string>();
    for (const option of prev.options) {
      for (const voterId of option.voters) {
        voterChoice.set(voterId, option.id);
      }
    }
    for (const option of next.options) {
      for (const voterId of option.voters) {
        voterChoice.set(voterId, option.id);
      }
    }

    const optionIds = [...new Set([...next.options.map((o) => o.id), ...prev.options.map((o) => o.id)])];
    const options = optionIds.map((id) => {
      const incoming = next.options.find((o) => o.id === id);
      const previous = prev.options.find((o) => o.id === id);
      const voters = [...voterChoice.entries()]
        .filter(([, optionId]) => optionId === id)
        .map(([voterId]) => voterId);
      return {
        id,
        label: incoming?.label || previous?.label || '',
        voters,
        votes: voters.length,
      };
    });

    return {
      ...next,
      question: next.question || prev.question,
      options,
    };
  }

  const options = next.options.map((option) => {
    const previous = prev.options.find((o) => o.id === option.id);
    if (!previous) return option;

    return {
      ...option,
      label: option.label || previous.label,
      votes: Math.max(option.votes, previous.votes),
    };
  });

  return {
    ...next,
    question: next.question || prev.question,
    options,
  };
}

function pollSignature(poll: ActivePoll): string {
  const normalized = normalizePoll(poll);
  return JSON.stringify({
    question: normalized.question,
    open: normalized.open,
    options: normalized.options.map((option) => ({
      id: option.id,
      votes: option.votes,
      voters: [...option.voters].sort(),
    })),
  });
}

/** Whether a poll update should count as new activity for notifications. */
export function pollActivityChanged(prev: ActivePoll | null, next: ActivePoll | null): boolean {
  if (!next) return false;
  if (!prev) return true;
  if (prev.id !== next.id) return true;
  return pollSignature(prev) !== pollSignature(next);
}

function applyVoteWithVoter(poll: ActivePoll, optionId: string, voterId: string): ActivePoll {
  const options = poll.options.map((option) => {
    let voters = [...(option.voters ?? [])].filter((v) => v !== voterId);
    if (option.id === optionId) voters.push(voterId);
    return { ...option, voters, votes: voters.length };
  });
  return { ...poll, options };
}

export function applyVote(poll: ActivePoll, optionId: string, voterId = ''): ActivePoll {
  if (voterId) return applyVoteWithVoter(poll, optionId, voterId);

  const next = { ...poll, options: poll.options.map((o) => ({ ...o })) };
  for (const o of next.options) {
    if (o.id === optionId) o.votes += 1;
  }
  return next;
}
