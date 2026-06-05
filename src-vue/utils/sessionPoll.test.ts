import { describe, expect, it, vi } from 'vitest';
import {
  applyVote,
  canCreatePoll,
  canVote,
  formatPollResultsMessage,
  mergePolls,
  normalizePoll,
  pollActivityChanged,
  pollOptionPercent,
  pollResultsSenderId,
  pollTotalVotes,
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

  it('records votes by voter id without losing concurrent votes', () => {
    const votedA = applyVote(poll, 'a', 'user-a');
    const votedB = applyVote(poll, 'b', 'user-b');
    const merged = mergePolls(votedA, votedB);
    expect(merged.options.find((o) => o.id === 'a')?.votes).toBe(1);
    expect(merged.options.find((o) => o.id === 'b')?.votes).toBe(1);
    expect(merged.options.find((o) => o.id === 'a')?.voters).toContain('user-a');
  });

  it('increments legacy polls without a voter id', () => {
    const next = applyVote(poll, 'b');
    expect(next.options.find((o) => o.id === 'b')?.votes).toBe(1);
  });

  it('detects poll activity changes', () => {
    const voted = applyVote(poll, 'a', 'user-a');
    expect(pollActivityChanged(null, voted)).toBe(true);
    expect(pollActivityChanged(voted, voted)).toBe(false);
    expect(pollActivityChanged(voted, applyVote(voted, 'b', 'user-b'))).toBe(true);
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

  it('totals votes and calculates percentages', () => {
    const voted = applyVote(poll, 'a');
    expect(pollTotalVotes(voted)).toBe(1);
    expect(pollOptionPercent(1, 1)).toBe(100);
    expect(pollOptionPercent(0, 0)).toBe(0);
  });

  it('validates poll creation drafts', () => {
    expect(canCreatePoll('', ['Yes', 'No'])).toBe(false);
    expect(canCreatePoll('Lunch?', ['Yes'])).toBe(false);
    expect(canCreatePoll('Lunch?', ['Yes', 'No'])).toBe(true);
    expect(canCreatePoll('Lunch?', [' Yes ', '', 'No'])).toBe(true);
  });

  it('returns false when chat send fails', () => {
    const ok = publishPollResultsToChat(
      { sendTextMessage: () => false, appendChatMessage: vi.fn() },
      poll,
      'host',
    );
    expect(ok).toBe(false);
  });

  it('normalizes voter-backed options and totals', () => {
    expect(pollTotalVotes(null)).toBe(0);
    const normalized = normalizePoll({
      ...poll,
      options: [
        { id: 'a', label: 'A', votes: 99, voters: ['u1', 'u2'] },
        { id: 'b', label: 'B', votes: 3 },
      ],
    });
    expect(normalized.options[0].votes).toBe(2);
    expect(normalized.options[1].votes).toBe(3);
  });

  it('merges legacy vote counts and new poll payloads', () => {
    const current = {
      id: 'p1',
      question: 'Old?',
      options: [{ id: 'a', label: 'A', votes: 2 }],
      open: true,
    };
    const incoming = {
      id: 'p2',
      question: 'New?',
      options: [{ id: 'x', label: 'X', votes: 1 }],
      open: true,
    };
    expect(mergePolls(incoming, current).id).toBe('p2');

    const mergedLegacy = mergePolls(
      {
        ...poll,
        options: [
          { id: 'a', label: '', votes: 1 },
          { id: 'b', label: 'B', votes: 0 },
        ],
      },
      {
        ...poll,
        options: [
          { id: 'a', label: 'A', votes: 2 },
          { id: 'b', label: 'B', votes: 0 },
        ],
      },
    );
    expect(mergedLegacy.options.find((o) => o.id === 'a')?.votes).toBe(2);
    expect(mergedLegacy.options.find((o) => o.id === 'a')?.label).toBe('A');
    expect(mergedLegacy.question).toBe('Q');
  });

  it('merges voter lists and moves ballots between options', () => {
    const base = {
      id: 'p1',
      question: 'Q',
      options: [
        { id: 'a', label: 'A', votes: 1, voters: ['u1'] },
        { id: 'b', label: 'B', votes: 0, voters: [] },
      ],
      open: true,
    };
    const switched = applyVote(base, 'b', 'u1');
    const merged = mergePolls(switched, base);
    expect(merged.options.find((o) => o.id === 'a')?.votes).toBe(0);
    expect(merged.options.find((o) => o.id === 'b')?.voters).toContain('u1');

    const withNewOption = mergePolls(
      {
        ...base,
        options: [...base.options, { id: 'c', label: 'C', votes: 0, voters: [] }],
      },
      base,
    );
    expect(withNewOption.options).toHaveLength(3);
  });

  it('ignores activity when a poll ends', () => {
    const voted = applyVote(poll, 'a', 'user-a');
    expect(pollActivityChanged(voted, null)).toBe(false);
    expect(pollActivityChanged(voted, { ...voted, id: 'p2' })).toBe(true);
  });

  it('merges legacy options and fills missing labels', () => {
    const merged = mergePolls(
      {
        id: 'p1',
        question: '',
        options: [{ id: 'new', label: 'N', votes: 1 }],
        open: true,
      },
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'a', label: 'A', votes: 2 }],
        open: true,
      },
    );
    expect(merged.question).toBe('Q');
    expect(merged.options).toHaveLength(1);
    expect(merged.options[0].id).toBe('new');
    expect(merged.options[0].votes).toBe(1);

    const labeled = mergePolls(
      {
        id: 'p1',
        question: 'Q',
        options: [
          { id: 'a', label: '', votes: 0, voters: ['u1'] },
          { id: 'b', label: 'B', votes: 0, voters: [] },
        ],
        open: true,
      },
      {
        id: 'p1',
        question: 'Q',
        options: [
          { id: 'a', label: 'A', votes: 0, voters: [] },
          { id: 'b', label: 'B', votes: 0, voters: [] },
        ],
        open: true,
      },
    );
    expect(labeled.options.find((o) => o.id === 'a')?.label).toBe('A');

    const fromCurrentQuestion = mergePolls(
      {
        id: 'p1',
        question: '',
        options: [{ id: 'a', label: 'A', votes: 0, voters: ['u1'] }],
        open: true,
      },
      {
        id: 'p1',
        question: 'Kept?',
        options: [{ id: 'a', label: 'A', votes: 0, voters: [] }],
        open: true,
      },
    );
    expect(fromCurrentQuestion.question).toBe('Kept?');

    const splitOptions = mergePolls(
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'b', label: 'B', votes: 0, voters: ['u1'] }],
        open: true,
      },
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'a', label: 'A', votes: 0, voters: [] }],
        open: true,
      },
    );
    expect(splitOptions.options.find((o) => o.id === 'a')?.label).toBe('A');
    expect(splitOptions.options.find((o) => o.id === 'b')?.voters).toContain('u1');

    const blankLabels = mergePolls(
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'a', label: '', votes: 0, voters: ['u1'] }],
        open: true,
      },
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'a', label: '', votes: 0, voters: [] }],
        open: true,
      },
    );
    expect(blankLabels.options[0].label).toBe('');
  });

  it('applies voter-backed ballots on options without existing voter lists', () => {
    const voted = applyVote(
      { ...poll, options: [{ id: 'a', label: 'A', votes: 0 }] },
      'a',
      'u1',
    );
    expect(voted.options[0].voters).toEqual(['u1']);
  });

  it('ignores legacy votes for unknown options', () => {
    const next = applyVote(poll, 'missing');
    expect(pollTotalVotes(next)).toBe(0);
  });

  it('merges polls when voter arrays are missing on the wire', () => {
    const merged = mergePolls(
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'a', label: 'A', votes: 1, voters: null as unknown as string[] }],
        open: true,
      },
      {
        id: 'p1',
        question: 'Q',
        options: [{ id: 'a', label: 'A', votes: 0, voters: ['u1'] }],
        open: true,
      },
    );
    expect(merged.options[0].voters).toContain('u1');
  });

  it('formats plural vote labels in chat results', () => {
    const text = formatPollResultsMessage({
      ...poll,
      options: [
        { id: 'a', label: 'A', votes: 2 },
        { id: 'b', label: 'B', votes: 2 },
      ],
    });
    expect(text).toContain('2 votes');
  });
});
