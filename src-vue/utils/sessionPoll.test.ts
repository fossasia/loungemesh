import { describe, expect, it, vi } from 'vitest';
import {
  applyVote,
  canVote,
  formatPollResultsMessage,
  pollResultsSenderId,
  publishPollResultsToChat,
} from './sessionPoll';

describe('sessionPoll', () => {
  const poll = {
    id: 'p1',
    question: 'Q',
    options: [
      { id: 'a', label: 'A', votes: 0 },
      { id: 'b', label: 'B', votes: 0 },
    ],
    open: true,
  };

  it('blocks duplicate votes and closed polls', () => {
    expect(canVote('', poll)).toBe(true);
    expect(canVote('a', poll)).toBe(false);
    expect(canVote('', null)).toBe(false);
    expect(canVote('', { ...poll, open: false })).toBe(false);
  });

  it('increments the chosen option', () => {
    const next = applyVote(poll, 'b');
    expect(next.options.find((o) => o.id === 'b')?.votes).toBe(1);
  });

  it('resolves poll result sender ids', () => {
    expect(pollResultsSenderId('local')).toBe('local');
    expect(pollResultsSenderId('', 'engine')).toBe('engine');
    expect(pollResultsSenderId('', undefined)).toBe('');
  });

  it('formats poll results for chat', () => {
    const voted = applyVote({ ...poll, question: 'Lunch?' }, 'b');
    const text = formatPollResultsMessage(voted);
    expect(text).toContain('Poll results: Lunch?');
    expect(text).toContain('B: 1 vote');
    expect(text).toContain('A: 0 votes');
  });

  it('publishes poll results through conference chat', () => {
    const send = vi.fn(() => true);
    const append = vi.fn();
    const ok = publishPollResultsToChat(
      { sendTextMessage: send, appendChatMessage: append },
      poll,
      'host',
    );
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('Poll results: Q'));
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'host', text: expect.stringContaining('Poll results: Q') }),
    );
  });

  it('returns false when chat send fails', () => {
    const ok = publishPollResultsToChat(
      { sendTextMessage: () => false, appendChatMessage: vi.fn() },
      poll,
      'host',
    );
    expect(ok).toBe(false);
  });
});
