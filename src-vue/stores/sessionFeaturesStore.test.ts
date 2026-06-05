import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from './sessionFeaturesStore';

describe('sessionFeaturesStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  it('tracks host and lobby state', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.approveLobby('host');
    expect(features.isHost).toBe(true);
    expect(features.isLobbyBlocked).toBe(false);

    features.lobbyEnabled = true;
    local.setMyID('guest');
    features.localLobbyPending = true;
    expect(features.isLobbyBlocked).toBe(true);

    features.approveLobby('guest');
    features.localLobbyPending = false;
    expect(features.isLobbyBlocked).toBe(false);
  });

  it('manages reactions, polls, and panels', () => {
    const features = useSessionFeaturesStore();
    features.setReaction('u1', '👍');
    expect(features.userReactions.u1?.emoji).toBe('👍');
    vi.advanceTimersByTime(2500);
    expect(features.userReactions.u1).toBeUndefined();

    const poll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 0 }],
      open: true,
    };
    features.applyPoll(poll);
    expect(features.activePoll?.id).toBe('p1');
    features.myPollVote = 'a';
    features.applyPoll({ ...poll, options: [{ id: 'a', label: 'A', votes: 1 }] });
    expect(features.myPollVote).toBe('a');
    features.applyPoll({ ...poll, id: 'p2' });
    expect(features.myPollVote).toBe('');
    features.applyPoll(null);
    expect(features.activePoll).toBeNull();

    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.togglePanel('poll');
    expect(features.panel).toBe('poll');
    features.togglePanel('poll');
    expect(features.panel).toBe('');
  });

  it('does not block the host when lobby is on', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.lobbyEnabled = true;
    expect(features.isLobbyBlocked).toBe(false);
  });

  it('skips expiry when the reaction timestamp changed', () => {
    const features = useSessionFeaturesStore();
    features.setReaction('u1', '👍');
    features.userReactions.u1!.at = 999;
    vi.advanceTimersByTime(2500);
    expect(features.userReactions.u1?.emoji).toBe('👍');
  });

  it('stores whiteboard strokes', () => {
    const features = useSessionFeaturesStore();
    const stroke = {
      id: 's1',
      color: '#000',
      width: 2,
      points: [{ x: 0, y: 0 }],
    };
    features.addWhiteboardStroke(stroke);
    expect(features.whiteboardStrokes[0]?.id).toBe('s1');
    features.clearWhiteboard();
    expect(features.whiteboardStrokes).toEqual([]);
  });

  it('treats first joiner as host before host id is assigned', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('first');
    features.resetHostForJoin();
    expect(features.isHost).toBe(true);
    expect(features.canUseNotes).toBe(true);
    expect(features.canUseWhiteboard).toBe(true);
  });

  it('claims host on join after resetHostForJoin', () => {
    const features = useSessionFeaturesStore();
    features.resetHostForJoin();
    expect(features.pendingHostClaim).toBe(true);
    expect(features.isHost).toBe(false);
  });

  it('resets host state when leaving', () => {
    const features = useSessionFeaturesStore();
    features.setHost('host');
    features.panel = 'poll';
    features.resetForLeave();
    expect(features.hostId).toBe('');
    expect(features.panel).toBe('');
  });

  it('gates notes and whiteboard panels for non-host participants', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.togglePanel('notes');
    expect(features.panel).toBe('');
    features.togglePanel('whiteboard');
    expect(features.panel).toBe('');
    features.setRoomDefault('notes', true);
    features.togglePanel('notes');
    expect(features.panel).toBe('notes');
    features.setRoomDefault('whiteboard', true);
    features.togglePanel('whiteboard');
    expect(features.panel).toBe('whiteboard');
    expect(features.canClearWhiteboard).toBe(false);
    local.setMyID('host');
    expect(features.canClearWhiteboard).toBe(true);
  });

  it('applies per-user access updates', () => {
    const features = useSessionFeaturesStore();
    features.applyAccessUpdate({
      defaults: { notes: true, whiteboard: false, poll: false, stage: false },
    });
    expect(features.roomDefaults.notes).toBe(true);
    features.applyAccessUpdate({
      userId: 'u2',
      grants: { poll: true, stage: true },
    });
    expect(features.grantsForUser('u2').poll).toBe(true);
    expect(features.grantsForUser('u2').stage).toBe(true);
  });

  it('dedupes lobby waiters', () => {
    const features = useSessionFeaturesStore();
    features.addLobbyWaiter({ id: 'g1', name: 'Guest' });
    features.addLobbyWaiter({ id: 'g1', name: 'Guest' });
    expect(features.lobbyWaiting).toHaveLength(1);
    features.approveLobby('g1');
    expect(features.lobbyWaiting).toHaveLength(0);
  });

  it('tracks unread poll activity', () => {
    const features = useSessionFeaturesStore();
    features.bumpPollActivity();
    expect(features.hasUnreadPoll).toBe(true);
    features.togglePanel('poll');
    expect(features.hasUnreadPoll).toBe(false);
  });

  it('marks poll seen when activity bumps while the poll panel is open', () => {
    const features = useSessionFeaturesStore();
    features.panel = 'poll';
    features.pollActivitySeq = 4;
    features.pollSeenSeq = 1;
    features.bumpPollActivity();
    expect(features.pollSeenSeq).toBe(4);
    expect(features.pollActivitySeq).toBe(4);
  });

  it('no-ops syncMyPollVoteFromPoll when no poll is active', () => {
    const features = useSessionFeaturesStore();
    features.myPollVote = 'a';
    features.activePoll = null;
    features.syncMyPollVoteFromPoll();
    expect(features.myPollVote).toBe('a');
  });

  it('does not sync myPollVote without a local participant id', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('');
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 1, voters: ['guest'] }],
      open: true,
    };
    features.myPollVote = 'a';
    features.syncMyPollVoteFromPoll();
    expect(features.myPollVote).toBe('a');
  });

  it('syncs ballots when voter lists are present on other options', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [
        { id: 'a', label: 'A', votes: 1 },
        { id: 'b', label: 'B', votes: 1, voters: ['other'] },
      ],
      open: true,
    };
    features.myPollVote = 'a';
    features.syncMyPollVoteFromPoll();
    expect(features.myPollVote).toBe('');
  });

  it('does not sync myPollVote without voter tracking or a matching ballot', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 1 }],
      open: true,
    };
    features.myPollVote = 'a';
    features.syncMyPollVoteFromPoll();
    expect(features.myPollVote).toBe('a');

    local.setMyID('guest');
    features.activePoll = {
      id: 'p1',
      question: 'Q',
      options: [{ id: 'a', label: 'A', votes: 1, voters: ['other'] }],
      open: true,
    };
    features.myPollVote = 'a';
    features.syncMyPollVoteFromPoll();
    expect(features.myPollVote).toBe('');
  });

  it('merges poll votes and syncs the local ballot', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('voter');
    const poll = {
      id: 'p1',
      question: 'Q',
      options: [
        { id: 'a', label: 'A', votes: 0, voters: [] as string[] },
        { id: 'b', label: 'B', votes: 0, voters: [] as string[] },
      ],
      open: true,
    };
    features.applyPoll(poll);
    features.applyPoll({
      ...poll,
      options: [
        { id: 'a', label: 'A', votes: 1, voters: ['other'] },
        { id: 'b', label: 'B', votes: 0, voters: [] },
      ],
    });
    expect(features.activePoll?.options.find((o) => o.id === 'a')?.votes).toBe(1);
    features.applyPoll({
      ...poll,
      options: [
        { id: 'a', label: 'A', votes: 1, voters: ['other'] },
        { id: 'b', label: 'B', votes: 1, voters: ['voter'] },
      ],
    });
    expect(features.activePoll?.options.find((o) => o.id === 'b')?.votes).toBe(1);
    expect(features.myPollVote).toBe('b');
  });

  it('tracks unread notes and whiteboard activity', () => {
    const features = useSessionFeaturesStore();
    features.setRoomDefault('notes', true);
    features.setRoomDefault('whiteboard', true);
    features.bumpNotesActivity();
    expect(features.hasUnreadNotes).toBe(true);
    features.togglePanel('notes');
    expect(features.hasUnreadNotes).toBe(false);

    features.bumpWhiteboardActivity();
    expect(features.hasUnreadWhiteboard).toBe(true);
    features.togglePanel('whiteboard');
    expect(features.hasUnreadWhiteboard).toBe(false);
  });

  it('marks notes seen when activity bumps while the notes panel is open', () => {
    const features = useSessionFeaturesStore();
    features.setRoomDefault('notes', true);
    features.panel = 'notes';
    features.notesActivitySeq = 5;
    features.notesSeenSeq = 2;
    features.bumpNotesActivity();
    expect(features.notesSeenSeq).toBe(5);
    expect(features.notesActivitySeq).toBe(5);
  });

  it('marks whiteboard seen when activity bumps while the whiteboard panel is open', () => {
    const features = useSessionFeaturesStore();
    features.setRoomDefault('whiteboard', true);
    features.panel = 'whiteboard';
    features.whiteboardActivitySeq = 3;
    features.whiteboardSeenSeq = 1;
    features.bumpWhiteboardActivity();
    expect(features.whiteboardSeenSeq).toBe(3);
    expect(features.whiteboardActivitySeq).toBe(3);
  });
});
