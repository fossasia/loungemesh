import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { encodeNotesForWire } from '@/utils/notesSync';
import { useSessionFeaturesStore } from './sessionFeaturesStore';
import { useAuthStore } from '@/stores/authStore';

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

  it('checks isLobbyBlocked when local.id is empty', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    features.lobbyEnabled = true;
    features.setHost('some-host');
    local.setMyID('');

    features.localLobbyPending = true;
    expect(features.isLobbyBlocked).toBe(true);

    features.localLobbyPending = false;
    expect(features.isLobbyBlocked).toBe(false);
  });

  it('allows invited or host/moderator users to bypass the lobby, but blocks uninvited users', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    features.lobbyEnabled = true;
    features.setHost('real-host');
    local.setMyID('guest');
    
    // Uninvited is blocked
    features.isInvited = false;
    expect(features.isLobbyBlocked).toBe(true);

    // Invited bypasses
    features.isInvited = true;
    expect(features.isLobbyBlocked).toBe(false);
  });

  it('prevents non-authorized users from toggling restricted panels', () => {
    const features = useSessionFeaturesStore();
    features.setHost('real-host');
    features.isVerifiedHost = false;
    features.isVerifiedModerator = false;
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, moderator: false };

    features.panel = '';
    features.togglePanel('poll');
    expect(features.panel).toBe('');

    features.togglePanel('moderator');
    expect(features.panel).toBe('');

    features.togglePanel('notes');
    expect(features.panel).toBe('');

    features.togglePanel('whiteboard');
    expect(features.panel).toBe('');
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

  it('treats a joiner without a verified host email as an attendee', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('first');
    features.resetHostForJoin();
    features.pendingHostClaim = false;
    expect(features.isHost).toBe(false);
    expect(features.canUseNotes).toBe(false);
    expect(features.lobbyEnabled).toBe(true);
  });

  it('repeats lobby approval and the mapped host announcement', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const engine = { sendCommand: vi.fn() };
    local.setMyID('guest');
    features.lobbyEnabled = true;
    features.isInvited = true;
    features.resendSessionIdentity(engine);
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'lobby',
      JSON.stringify({ action: 'approve', id: 'guest' }),
    );
    expect(engine.sendCommand).not.toHaveBeenCalledWith('host', expect.any(String));

    features.isVerifiedHost = true;
    features.hostEmail = 'ada@example.com';
    engine.sendCommand.mockClear();
    features.resendSessionIdentity(engine);
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'host',
      expect.stringContaining('"email":"ada@example.com"'),
    );
    local.setMyID('');
    engine.sendCommand.mockClear();
    features.resendSessionIdentity(engine);
    expect(engine.sendCommand).not.toHaveBeenCalled();
    local.setMyID('guest');
    features.eventyayMeet = true;
    features.resendSessionIdentity(engine);
    expect(engine.sendCommand).not.toHaveBeenCalledWith('host', expect.any(String));
  });

  it('claims host on join after resetHostForJoin', () => {
    const features = useSessionFeaturesStore();
    features.resetHostForJoin();
    expect(features.pendingHostClaim).toBe(true);
    expect(features.isHost).toBe(false);
  });

  it('preserves host on reconnect in resetHostForJoin', () => {
    const features = useSessionFeaturesStore();
    features.hostId = 'host-123';
    features.pendingHostClaim = false;
    features.resetHostForJoin({ isReconnect: true });
    expect(features.hostId).toBe('host-123');
    expect(features.pendingHostClaim).toBe(false);
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
      defaults: { notes: true, whiteboard: false, poll: false },
    });
    expect(features.roomDefaults.notes).toBe(true);
    features.applyAccessUpdate({
      userId: 'u2',
      grants: { poll: true },
    });
    expect(features.grantsForUser('u2').poll).toBe(true);
  });

  it('keeps later room defaults when a join sync sends empty per-user grants', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.applyAccessUpdate({
      defaults: { notes: false, whiteboard: false, poll: false, moderator: false, chat: true },
      userId: 'guest',
      grants: {},
    });
    features.applyAccessUpdate({
      defaults: { notes: true, whiteboard: true, poll: true, moderator: false, chat: true },
    });
    expect(features.userGrants.guest).toBeUndefined();
    expect(features.canUseNotes).toBe(true);
    expect(features.canUseWhiteboard).toBe(true);
    expect(features.canUsePoll).toBe(true);
  });

  it('dedupes lobby waiters', () => {
    const features = useSessionFeaturesStore();
    features.addLobbyWaiter({ id: 'g1', name: 'Guest' });
    features.addLobbyWaiter({ id: 'g1', name: 'Guest' });
    expect(features.lobbyWaiting).toHaveLength(1);
    features.approveLobby('g1');
    expect(features.lobbyWaiting).toHaveLength(0);
  });

  it('rejects lobby waiters', () => {
    const features = useSessionFeaturesStore();
    features.addLobbyWaiter({ id: 'g1', name: 'Guest' });
    expect(features.lobbyWaiting).toHaveLength(1);
    features.rejectLobby('g1');
    expect(features.lobbyWaiting).toHaveLength(0);
  });

  it('tracks unread poll activity', () => {
    const features = useSessionFeaturesStore();
    features.isVerifiedHost = true;
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

  it('applies notes template only for host when notes are empty', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.setNotesTemplate('# Agenda');
    expect(features.applyNotesTemplateIfNeeded()).toBe(true);
    expect(features.sharedNotes).toBe('# Agenda');
    expect(features.applyNotesTemplateIfNeeded()).toBe(false);

    features.sharedNotes = '';
    local.setMyID('guest');
    features.setHost('host');
    expect(features.applyNotesTemplateIfNeeded()).toBe(false);
  });

  it('resets shared notes to the host template on demand', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.setNotesTemplate('# Agenda');
    features.sharedNotes = 'edited notes';
    const before = features.notesActivitySeq;
    expect(features.resetSharedNotesToTemplate()).toBe(true);
    expect(features.sharedNotes).toBe('# Agenda');
    expect(features.notesActivitySeq).toBeGreaterThan(before);

    local.setMyID('guest');
    features.setHost('host');
    features.sharedNotes = 'guest edit';
    expect(features.resetSharedNotesToTemplate()).toBe(false);
    expect(features.sharedNotes).toBe('guest edit');

    local.setMyID('host');
    features.setHost('host');
    features.clearNotesTemplate();
    expect(features.resetSharedNotesToTemplate()).toBe(false);
  });

  it('manages and clears host room settings properties', () => {
    const features = useSessionFeaturesStore();
    features.hostSettingsSessionId = 'room-1';
    features.setGridBackgroundUrl('data:test');
    features.setNotesTemplate('# Notes');
    expect(features.gridBackgroundUrl).toBe('data:test');
    expect(features.notesTemplate).toBe('# Notes');

    features.clearGridBackground();
    features.clearNotesTemplate();
    expect(features.gridBackgroundUrl).toBe('');
    expect(features.notesTemplate).toBe('');
  });

  it('records session id when loading settings', () => {
    const features = useSessionFeaturesStore();
    features.loadPersistedHostSettings('room-2');
    expect(features.hostSettingsSessionId).toBe('room-2');
  });

  it('skips loading persisted settings for empty session ids', () => {
    const features = useSessionFeaturesStore();
    features.hostSettingsSessionId = 'keep';
    features.loadPersistedHostSettings('');
    expect(features.hostSettingsSessionId).toBe('keep');
  });

  it('reassembles chunked shared notes with markdown', () => {
    const features = useSessionFeaturesStore();
    const encoded = encodeNotesForWire('# Title\n\n- item & <tag>');
    features.applyNotesCommand({ action: 'begin', total: 1 });
    features.applyNotesCommand({ action: 'chunk', index: 0, data: encoded });
    expect(features.sharedNotes).toBe('# Title\n\n- item & <tag>');
    features.applyNotesCommand({ action: 'clear' });
    expect(features.sharedNotes).toBe('');
  });

  it('ignores orphan notes chunks and missing chunk indices', () => {
    const features = useSessionFeaturesStore();
    features.applyNotesCommand({ action: 'chunk', index: 0, data: encodeNotesForWire('orphan') });
    expect(features.sharedNotes).toBe('');

    features.applyNotesCommand({ action: 'begin', total: 2 });
    features.applyNotesCommand({ action: 'chunk', index: 0, data: encodeNotesForWire('a') });
    features.applyNotesCommand({ action: 'chunk', index: 2, data: encodeNotesForWire('c') });
    expect(features.sharedNotes).toBe('a');
  });

  it('updates room background commands on reload or clear', async () => {
    vi.useRealTimers();
    const features = useSessionFeaturesStore();
    
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ backgroundUrl: 'data:image/jpeg;base64,abc' }),
      } as Response)
    );
    vi.stubGlobal('fetch', fetchSpy);

    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { pathname: '/room/room-name' } as any;

    features.applyRoomBackgroundCommand({ action: 'reload' });
    
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(fetchSpy).toHaveBeenCalledWith('/api/meetings/state/room-name/background');
    expect(features.gridBackgroundUrl).toBe('data:image/jpeg;base64,abc');

    features.applyRoomBackgroundCommand({ action: 'clear' });
    expect(features.gridBackgroundUrl).toBe('');

    vi.unstubAllGlobals();
    window.location = originalLocation;
  });

  it('verifies default empty state on join reset', () => {
    const features = useSessionFeaturesStore();
    features.resetForLeave();
    expect(features.gridBackgroundUrl).toBe('');
    expect(features.notesTemplate).toBe('');
  });

  it('detects stage mode from occupant id, property fallback, or local onStage', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();

    expect(features.isStageModeActive).toBe(false);
    expect(features.isLocalStageOccupant).toBe(false);

    features.stageOccupantId = 'presenter';
    expect(features.isStageModeActive).toBe(true);

    local.setMyID('presenter');
    expect(features.isLocalStageOccupant).toBe(true);

    features.stageOccupantId = '';
    local.onStage = true;
    expect(features.isStageModeActive).toBe(true);
    expect(features.isLocalStageOccupant).toBe(true);

    local.onStage = false;
    conference.addUser('remote');
    conference.users.remote.properties = { onStage: 'true' };
    expect(features.isStageModeActive).toBe(true);
    expect(features.isLocalStageOccupant).toBe(false);
  });

  it('manages stage message and its timeout', () => {
    const features = useSessionFeaturesStore();
    
    // Empty message does not start timeout
    features.setStageMessage('');
    expect(features.stageMessage).toBe('');
    
    // Setting message starts timeout
    features.setStageMessage('Hello Stage');
    expect(features.stageMessage).toBe('Hello Stage');
    
    // Wait less than 4000ms
    vi.advanceTimersByTime(2000);
    expect(features.stageMessage).toBe('Hello Stage');
    
    // Wait the rest, it should clear
    vi.advanceTimersByTime(2000);
    expect(features.stageMessage).toBe('');
    
    // Setting message and overriding it before timeout
    features.setStageMessage('Msg 1');
    vi.advanceTimersByTime(2000);
    features.setStageMessage('Msg 2');
    // After another 2000ms (original 4000ms mark), Msg 2 should still be there because message !== original message
    vi.advanceTimersByTime(2000);
    expect(features.stageMessage).toBe('Msg 2');
    
    // Wait remaining for second message
    vi.advanceTimersByTime(2000);
    expect(features.stageMessage).toBe('');
  });

  it('respects meetingExists for host checks', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('my-id');
    
    // A link join does not make the first person host.
    features.meetingExists = false;
    features.hostId = '';
    expect(features.isHost).toBe(false);
    
    features.hostId = 'my-id';
    expect(features.isHost).toBe(true);
    
    features.hostId = 'other-id';
    expect(features.isHost).toBe(false);

    // With meetingExists: true
    features.meetingExists = true;
    features.hostId = '';
    expect(features.isHost).toBe(false); // Guest cannot steal host
    
    features.hostId = 'my-id';
    expect(features.isHost).toBe(true);
    
    features.hostId = 'other-id';
    expect(features.isHost).toBe(false);
  });

  it('covers isHost and isModerator role getters', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host-id');

    // Case 1: isVerifiedHost is true
    features.isVerifiedHost = true;
    expect(features.isHost).toBe(true);
    expect(features.isModerator).toBe(true);
    expect(features.isAttendee).toBe(false);
    expect(features.userRole).toBe('host');

    // Case 2: isVerifiedHost is false, isVerifiedModerator is true
    features.meetingExists = true;
    features.hostId = 'other-host';
    features.isVerifiedHost = false;
    features.isVerifiedModerator = true;
    expect(features.isHost).toBe(false);
    expect(features.isModerator).toBe(true);
    expect(features.isAttendee).toBe(false);
    expect(features.userRole).toBe('moderator');

    // Case 3: both verified are false, hostId is my local id
    features.isVerifiedModerator = false;
    features.hostId = 'host-id';
    expect(features.isModerator).toBe(true);
    expect(features.isAttendee).toBe(false);

    // Case 4: eventyayMeet is true, verified is false -> isModerator returns false even if hostId matches
    features.eventyayMeet = true;
    expect(features.isModerator).toBe(false);
    expect(features.isAttendee).toBe(true);
    expect(features.userRole).toBe('attendee');
  });

  it('returns false for isHost while fetching config', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('my-id');
    features.hostId = 'my-id';
    features.isFetchingConfig = true;
    expect(features.isHost).toBe(false);
  });

  it('evaluates capability-based getters when eventyayMeet is active', () => {
    const features = useSessionFeaturesStore();
    features.eventyayMeet = true;
    features.stagePromotionEnabled = true;

    // With specific capabilities
    features.capabilities = ['whiteboard', 'poll_manage', 'moderate'];
    expect(features.canUseNotes).toBe(false);
    expect(features.canUseWhiteboard).toBe(true);
    expect(features.canUsePoll).toBe(true);
    expect(features.canPromoteToStage).toBe(true);
    expect(features.canClearWhiteboard).toBe(true);

    // Without moderate capability
    features.capabilities = ['notes'];
    expect(features.canUseNotes).toBe(true);
    expect(features.canUseWhiteboard).toBe(false);
    expect(features.canUsePoll).toBe(false);
    expect(features.canPromoteToStage).toBe(false);
    expect(features.canClearWhiteboard).toBe(false);

    // Empty capabilities falls back to localGrants
    features.capabilities = [];
    features.roomDefaults.whiteboard = true;
    features.roomDefaults.poll = true;
    expect(features.canUseWhiteboard).toBe(true);
    expect(features.canUsePoll).toBe(true);

    // isReviewer getter
    features.eventyayRole = 'reviewer';
    expect(features.isReviewer).toBe(true);
    features.eventyayRole = 'moderator';
    expect(features.isReviewer).toBe(true);
    features.eventyayRole = 'attendee';
    expect(features.isReviewer).toBe(false);
  });

  it('manages poll requests and evaluates poll request getters', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('attendee-1');

    // Host cannot request poll
    features.isVerifiedHost = true;
    expect(features.canRequestPoll).toBe(false);
    expect(features.canManagePoll).toBe(true);
    expect(features.canAccessPoll).toBe(true);

    // Moderator cannot request poll
    features.isVerifiedHost = false;
    features.isVerifiedModerator = true;
    expect(features.canRequestPoll).toBe(false);
    expect(features.canManagePoll).toBe(true);

    // Regular attendee in eventyay can request poll
    features.isVerifiedModerator = false;
    features.eventyayMeet = true;
    features.capabilities = ['notes'];
    expect(features.canRequestPoll).toBe(true);
    expect(features.canManagePoll).toBe(false);
    expect(features.canAccessPoll).toBe(true);

    features.capabilities = ['poll_manage'];
    expect(features.canManagePoll).toBe(true);
    features.capabilities = ['moderate'];
    expect(features.canManagePoll).toBe(true);

    // Guest in standard room without poll grant cannot request poll
    features.setHost('other-host');
    features.eventyayMeet = false;
    features.capabilities = [];
    features.roomDefaults.poll = false;
    expect(features.canRequestPoll).toBe(false);
    expect(features.canAccessPoll).toBe(false);

    // Guest in standard room with poll grant can request poll
    features.roomDefaults.poll = true;
    expect(features.canRequestPoll).toBe(true);
    expect(features.canAccessPoll).toBe(true);

    // Adding and removing poll requests
    const req1 = {
      id: 'pr-1',
      question: 'Topic?',
      options: ['Tech', 'Design'],
      requesterId: 'attendee-1',
      requesterName: 'Attendee 1',
      createdAt: 1000,
    };
    features.addPollRequest(req1);
    features.addPollRequest(req1); // duplicate ignored
    expect(features.pendingPollRequests).toHaveLength(1);
    expect(features.myPendingPollRequest?.id).toBe('pr-1');

    // Matching by myPendingPollRequestId
    local.setMyID('someone-else');
    expect(features.myPendingPollRequest).toBeUndefined();
    features.myPendingPollRequestId = 'pr-1';
    expect(features.myPendingPollRequest?.id).toBe('pr-1');

    features.removePollRequest('pr-1');
    expect(features.pendingPollRequests).toHaveLength(0);
    expect(features.myPendingPollRequestId).toBe('');

    // Clear poll requests
    features.addPollRequest(req1);
    features.myPendingPollRequestId = 'pr-1';
    features.pollRequestNotice = 'Notice';
    features.clearPollRequests();
    expect(features.pendingPollRequests).toHaveLength(0);
    expect(features.myPendingPollRequestId).toBe('');
    expect(features.pollRequestNotice).toBe('');
  });

  it('manages whiteboard and notes moderation changes with auto-approval and manual review', () => {
    vi.useFakeTimers();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();

    // canModerate getter tests
    local.setMyID('u-host');
    features.setHost('u-host');
    expect(features.canModerate).toBe(true);

    local.setMyID('u-guest');
    expect(features.canModerate).toBe(false);

    features.eventyayMeet = true;
    features.capabilities = ['moderate'];
    expect(features.canModerate).toBe(true);

    features.capabilities = ['chat'];
    expect(features.canModerate).toBe(false);
    features.eventyayMeet = false;
    features.capabilities = [];

    // Mock engine
    const mockEngine = { sendCommand: vi.fn() };

    // 1. Whiteboard change with 15s auto-approval
    const stroke = { id: 's1', color: '#000', width: 2, points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] };
    features.addModerationChange({
      id: 'mc-wb-1',
      type: 'whiteboard',
      authorId: 'u-guest',
      authorName: 'Guest',
      payload: stroke,
      timestamp: Date.now(),
    }, mockEngine);

    // Duplicate ignored
    features.addModerationChange({
      id: 'mc-wb-1',
      type: 'whiteboard',
      authorId: 'u-guest',
      authorName: 'Guest',
      payload: stroke,
      timestamp: Date.now(),
    }, mockEngine);
    expect(features.pendingModerationChanges).toHaveLength(1);

    // Advance 15s -> auto-approves
    vi.advanceTimersByTime(15000);
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.whiteboardStrokes).toHaveLength(1);
    expect(features.whiteboardStrokes[0].id).toBe('s1');

    // 2. Notes change with manual approval
    features.addModerationChange({
      id: 'mc-notes-1',
      type: 'notes',
      authorId: 'u-guest',
      authorName: 'Guest',
      payload: 'Updated notes',
      timestamp: Date.now(),
    }, mockEngine);
    expect(features.pendingModerationChanges).toHaveLength(1);

    features.approveModerationChange('mc-notes-1', mockEngine);
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.sharedNotes).toBe('Updated notes');
    expect(mockEngine.sendCommand).toHaveBeenCalledWith(
      'mod_change',
      JSON.stringify({ action: 'approve', id: 'mc-notes-1' }),
    );

    // Approve unknown id does nothing
    features.approveModerationChange('unknown-id', mockEngine);

    // 3. Notes change with rejection
    features.addModerationChange({
      id: 'mc-notes-2',
      type: 'notes',
      authorId: 'u-guest',
      authorName: 'Guest',
      payload: 'Rejected text',
      timestamp: Date.now(),
    }, mockEngine);
    expect(features.pendingModerationChanges).toHaveLength(1);

    features.rejectModerationChange('mc-notes-2', mockEngine);
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.sharedNotes).toBe('Updated notes'); // still previous notes
    expect(mockEngine.sendCommand).toHaveBeenCalledWith(
      'mod_change',
      JSON.stringify({ action: 'reject', id: 'mc-notes-2' }),
    );

    // Reject unknown id does nothing
    features.rejectModerationChange('unknown-id', mockEngine);

    // 4. clearAllModerationTimers and resetForLeave
    features.addModerationChange({
      id: 'mc-wb-3',
      type: 'whiteboard',
      authorId: 'u-guest',
      authorName: 'Guest',
      payload: stroke,
      timestamp: Date.now(),
    });
    expect(features.pendingModerationChanges).toHaveLength(1);
    features.clearAllModerationTimers();
    expect(features.pendingModerationChanges).toHaveLength(0);

    // resetForLeave also clears timers and Eventyay state
    features.addModerationChange({
      id: 'mc-wb-4',
      type: 'whiteboard',
      authorId: 'u-guest',
      authorName: 'Guest',
      payload: stroke,
      timestamp: Date.now(),
    });
    features.setIntegrationAccess('moderator', ['moderate']);
    expect(features.eventyayMeet).toBe(true);
    expect(features.capabilities).toEqual(['moderate']);

    features.resetForLeave();
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.eventyayMeet).toBe(false);
    expect(features.eventyayRole).toBe('');
    expect(features.capabilities).toEqual([]);
    expect(features.isInvited).toBe(false);

    vi.useRealTimers();
  });

  it('enables and disables features via setFeatureEnabled and applyConfigUpdate', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    const engine = { sendCommand: vi.fn() };

    features.isVerifiedHost = true;
    features.panel = 'notes';
    await features.setFeatureEnabled('notes', false, engine);
    expect(features.enabledFeatures.notes).toBe(false);
    expect(features.panel).toBe('');
    expect(engine.sendCommand).toHaveBeenCalledWith('config', expect.stringContaining('"notes":false'));

    // Non-host does not broadcast config
    engine.sendCommand.mockClear();
    features.isVerifiedHost = false;
    features.eventyayMeet = true; // ensure isHost returns false
    await features.setFeatureEnabled('notes', true, engine);
    expect(engine.sendCommand).not.toHaveBeenCalled();
    features.eventyayMeet = false;
    features.isVerifiedHost = true;

    // stage disabling clears stage occupant
    local.setMyID('stager');
    conference.addUser('stager');
    features.stageOccupantId = 'stager';
    expect(features.isStageModeActive).toBe(true);
    await features.setFeatureEnabled('stage', false, engine);
    expect(features.stageOccupantId).toBe('');

    // applyConfigUpdate updates all fields and closes panels when disabled
    features.panel = 'whiteboard';
    features.applyConfigUpdate({
      allowParticipantRecording: true,
      lobbyEnabled: true,
      stagePromotionEnabled: false,
      enabledFeatures: {
        whiteboard: false,
        poll: false,
        chat: false,
      },
    });
    expect(features.allowParticipantRecording).toBe(true);
    expect(features.lobbyEnabled).toBe(true);
    expect(features.stagePromotionEnabled).toBe(false);
    expect(features.enabledFeatures.whiteboard).toBe(false);
    expect(features.panel).toBe('');

    features.panel = 'poll';
    features.applyConfigUpdate({ enabledFeatures: { poll: false } });
    expect(features.panel).toBe('');

    features.panel = 'chat';
    features.applyConfigUpdate({ enabledFeatures: { chat: false } });
    expect(features.panel).toBe('');

    features.panel = 'notes';
    features.applyConfigUpdate({ enabledFeatures: { notes: false } });
    expect(features.panel).toBe('');

    // setFeatureEnabled with enabled: true and no engine
    await features.setFeatureEnabled('notes', true);
    expect(features.enabledFeatures.notes).toBe(true);

    // chat panel gating when chat is disabled
    features.enabledFeatures.chat = false;
    features.panel = '';
    features.togglePanel('chat');
    expect(features.panel).toBe('');

    // isModerator check for host
    local.setMyID('my-host-id');
    features.setHost('my-host-id');
    features.isVerifiedHost = false;
    features.isVerifiedModerator = false;
    expect(features.isModerator).toBe(true);

    // feature getters when features are disabled room-wide
    features.enabledFeatures = {
      poll: false,
      whiteboard: false,
      notes: false,
      stage: false,
      chat: false,
    };
    expect(features.canUsePoll).toBe(false);
    expect(features.canRequestPoll).toBe(false);
    expect(features.canManagePoll).toBe(false);
    expect(features.canAccessPoll).toBe(false);
    expect(features.canClearWhiteboard).toBe(false);
    expect(features.canUseWhiteboard).toBe(false);
    expect(features.canUseNotes).toBe(false);
    expect(features.canPromoteToStage).toBe(false);
    expect(features.canUseChat).toBe(false);
  });
});
