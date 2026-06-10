import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { encodeNotesForWire } from './notesSync';
import { handleSessionCommand } from './sessionCommands';

vi.mock('@/utils/uiSounds', () => ({
  playUiSound: vi.fn(),
}));

describe('handleSessionCommand', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('updates position and session features', () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    conference.addUser('u1');
    handleSessionCommand('pos', { value: JSON.stringify({ id: 'u1', x: 1, y: 2 }) });
    expect(conference.users.u1.pos).toEqual({ x: 1, y: 2 });

    handleSessionCommand('name', { value: JSON.stringify({ id: 'u1', name: 'Renamed' }) });
    expect(conference.users.u1.user?._displayName).toBe('Renamed');

    handleSessionCommand('host', { value: JSON.stringify({ hostId: 'host1' }) });
    expect(features.hostId).toBe('host1');

    handleSessionCommand('react', { value: JSON.stringify({ id: 'u1', emoji: '👍' }) });
    expect(features.userReactions.u1?.emoji).toBe('👍');

    conference.addUser('u2');
    handleSessionCommand('hand', { value: JSON.stringify({ id: 'u2', raised: true }) });
    expect(conference.users.u2.properties.handRaised).toBe(true);
  });

  it('plays hand raise sound only once per raise', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const conference = useConferenceStore();
    conference.addUser('u2');
    const payload = { value: JSON.stringify({ id: 'u2', raised: true }) };
    handleSessionCommand('hand', payload);
    handleSessionCommand('hand', payload);
    handleSessionCommand('pos', { value: JSON.stringify({ id: 'u2', x: 3, y: 4 }) });
    handleSessionCommand('hand', payload);
    expect(playUiSound).toHaveBeenCalledTimes(1);
    expect(playUiSound).toHaveBeenCalledWith('handRaise');
  });

  it('applies room background commands', () => {
    const features = useSessionFeaturesStore();
    handleSessionCommand('room', {
      value: JSON.stringify({ gridBackgroundUrl: 'data:image/jpeg;base64,abc' }),
    });
    expect(features.gridBackgroundUrl).toBe('data:image/jpeg;base64,abc');

    handleSessionCommand('room', { value: JSON.stringify({ action: 'begin', total: 2 }) });
    handleSessionCommand('room', {
      value: JSON.stringify({ action: 'chunk', index: 0, data: 'data:image/jpeg;base64,' }),
    });
    handleSessionCommand('room', {
      value: JSON.stringify({ action: 'chunk', index: 1, data: 'abc' }),
    });
    expect(features.gridBackgroundUrl).toBe('data:image/jpeg;base64,abc');

    handleSessionCommand('room', { value: JSON.stringify({ action: 'clear' }) });
    expect(features.gridBackgroundUrl).toBe('');

    handleSessionCommand('room', { value: JSON.stringify({ gridBackgroundUrl: null }) });
    expect(features.gridBackgroundUrl).toBe('');

    handleSessionCommand('room', { value: 'not-json' });
    expect(features.gridBackgroundUrl).toBe('');

    handleSessionCommand('room', { value: JSON.stringify({ gridBackgroundUrl: 123 }) });
    expect(features.gridBackgroundUrl).toBe('');
  });

  it('handles lobby, poll, notes, and moderator actions', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('me');

    handleSessionCommand('lobby', {
      value: JSON.stringify({ enabled: true, action: 'wait', id: 'g1', name: 'Guest' }),
    });
    expect(features.lobbyEnabled).toBe(true);
    expect(features.lobbyWaiting[0]?.id).toBe('g1');

    features.localLobbyPending = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', id: 'me' }) });
    expect(features.lobbyApproved.me).toBe(true);
    expect(features.localLobbyPending).toBe(false);

    const poll = {
      id: 'p1',
      question: 'Q?',
      options: [
        { id: 'a', label: 'Yes', votes: 0 },
        { id: 'b', label: 'No', votes: 0 },
      ],
      open: true,
    };
    vi.mocked(playUiSound).mockClear();
    handleSessionCommand('poll', { value: JSON.stringify(poll) });
    expect(features.activePoll?.question).toBe('Q?');
    expect(features.hasUnreadPoll).toBe(true);
    expect(playUiSound).toHaveBeenCalledWith('chatMessage');

    features.panel = 'poll';
    features.pollSeenSeq = features.pollActivitySeq;
    vi.mocked(playUiSound).mockClear();
    handleSessionCommand('poll', {
      value: JSON.stringify({
        ...poll,
        options: [{ id: 'a', label: 'Yes', votes: 1, voters: ['other'] }],
      }),
    });
    expect(playUiSound).not.toHaveBeenCalled();
    expect(features.hasUnreadPoll).toBe(false);

    handleSessionCommand('poll', { value: 'not-json' });
    const bumps = features.pollActivitySeq;
    handleSessionCommand('poll', { value: JSON.stringify(poll) });
    expect(features.pollActivitySeq).toBe(bumps);

    handleSessionCommand('poll', { value: 'null' });
    expect(features.activePoll).toBeNull();

    handleSessionCommand('notes', { value: JSON.stringify({ text: 'hello' }) });
    expect(features.sharedNotes).toBe('hello');

    handleSessionCommand('notes', { value: JSON.stringify({ action: 'begin', total: 1 }) });
    handleSessionCommand('notes', {
      value: JSON.stringify({
        action: 'chunk',
        index: 0,
        data: encodeNotesForWire('# Markdown & <xml>'),
      }),
    });
    expect(features.sharedNotes).toBe('# Markdown & <xml>');

    handleSessionCommand('notes', { value: JSON.stringify({ action: 'clear' }) });
    expect(features.sharedNotes).toBe('');
    expect(features.hasUnreadNotes).toBe(true);

    handleSessionCommand('wb', {
      value: JSON.stringify({
        action: 'stroke',
        stroke: { id: 's1', color: '#000', width: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      }),
    });
    expect(features.whiteboardStrokes).toHaveLength(1);
    expect(features.hasUnreadWhiteboard).toBe(true);

    conference.addUser('other');
    const leaveSpy = vi.spyOn(conference, 'leaveConference');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick', id: 'me' }) });
    expect(leaveSpy).toHaveBeenCalled();
  });

  it('mutes local participant when targeted', async () => {
    const local = useLocalStore();
    local.setMyID('me');
    const toggleSpy = vi.spyOn(local, 'toggleMute').mockResolvedValue(undefined);
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'mute', id: 'me' }) });
    expect(toggleSpy).toHaveBeenCalled();
    local.mute = true;
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'mute', id: 'me' }) });
    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs feature access flags', () => {
    const features = useSessionFeaturesStore();
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ notes: true, whiteboard: true }) },
    );
    expect(features.roomDefaults.notes).toBe(true);
    expect(features.roomDefaults.whiteboard).toBe(true);
    handleSessionCommand('access', { value: JSON.stringify({ notes: false }) });
    expect(features.roomDefaults.notes).toBe(false);
    expect(features.roomDefaults.whiteboard).toBe(true);
    handleSessionCommand('access', { value: JSON.stringify({ whiteboard: false }) });
    expect(features.roomDefaults.whiteboard).toBe(false);
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ userId: 'u2', grants: { poll: true } }) },
    );
    expect(features.grantsForUser('u2').poll).toBe(true);
    handleSessionCommand('access', { value: 'bad' });
  });

  it('ignores incomplete chat edit payloads', () => {
    const conference = useConferenceStore();
    conference.appendChatMessage({
      id: 'u1',
      text: 'old',
      nr: 1,
      messageId: 'm1',
      history: [],
    });
    handleSessionCommand('chat', { value: 'not-json' });
    handleSessionCommand('chat', { value: JSON.stringify({ action: 'noop' }) });
    handleSessionCommand('chat', { value: JSON.stringify({ action: 'edit', messageId: 'm1' }) });
    expect(conference.messages[0].text).toBe('old');
  });

  it('applies chat edit commands', () => {
    const conference = useConferenceStore();
    conference.appendChatMessage({
      id: 'u1',
      text: 'old',
      nr: 1,
      messageId: 'm1',
      history: [],
    });
    handleSessionCommand(
      'chat',
      {
        value: JSON.stringify({
          action: 'edit',
          messageId: 'm1',
          text: 'new',
          editedAt: 500,
          editorId: 'u1',
        }),
      },
    );
    expect(conference.messages[0].text).toBe('new');
    expect(conference.messages[0].editedAt).toBe(500);
  });

  it('applies chat edits by nr when message ids differ', () => {
    const conference = useConferenceStore();
    conference.appendChatMessage({
      id: 'u1',
      text: 'old',
      nr: 9,
      messageId: 'm-9-u1',
      history: [],
    });
    handleSessionCommand(
      'chat',
      {
        value: JSON.stringify({
          action: 'edit',
          messageId: 'sender-uuid',
          text: 'new',
          editedAt: 500,
          editorId: 'u1',
          nr: 9,
        }),
      },
    );
    expect(conference.messages[0].text).toBe('new');
  });

  it('rejects chat edits from non-authors', () => {
    const conference = useConferenceStore();
    conference.appendChatMessage({
      id: 'u1',
      text: 'old',
      nr: 1,
      messageId: 'm1',
      history: [],
    });
    handleSessionCommand(
      'chat',
      {
        value: JSON.stringify({
          action: 'edit',
          messageId: 'm1',
          text: 'hacked',
          editedAt: 500,
          editorId: 'host',
        }),
      },
    );
    expect(conference.messages[0].text).toBe('old');
  });

  it('handles whiteboard commands', () => {
    const features = useSessionFeaturesStore();
    const stroke = {
      id: 's1',
      color: '#000',
      width: 2,
      points: [{ x: 1, y: 2 }],
    };
    handleSessionCommand('wb', { value: JSON.stringify({ action: 'stroke', stroke }) });
    expect(features.whiteboardStrokes[0]?.id).toBe('s1');
    handleSessionCommand('wb', { value: JSON.stringify({ action: 'clear' }) });
    expect(features.whiteboardStrokes).toEqual([]);
    handleSessionCommand('wb', { value: 'not-json' });
    handleSessionCommand('wb', { value: JSON.stringify({ action: 'noop' }) });
  });

  it('handles stage promote, demote, layout, and settings commands', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'promote', id: 'guest' }) });
    expect(features.stageOccupantId).toBe('guest');
    expect(local.onStage).toBe(true);

    // Set occupant to someone else to test layout sync commands (bypassing loopback check)
    features.stageOccupantId = 'someone-else';
    handleSessionCommand(
      'stage',
      { value: JSON.stringify({ action: 'layout', layout: { scale: 1.2, expanded: true } }) },
    );
    expect(features.stageLayout.scale).toBe(1.2);
    expect(features.stageLayout.expanded).toBe(true);

    // Restore guest occupant
    features.stageOccupantId = 'guest';
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'settings', stagePromotionEnabled: true }) });
    expect(features.stagePromotionEnabled).toBe(true);
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'demote', id: 'guest' }) });
    expect(features.stageOccupantId).toBe('');
    expect(local.onStage).toBe(false);
    handleSessionCommand('stage', { value: 'bad' });
  });

  it('deduplicates stage commands with unique cmdId and trims processed cache', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');

    // First invite should succeed
    handleSessionCommand('stage', {
      value: JSON.stringify({ action: 'invite', id: 'guest', _cmdId: 'unique-1' }),
    });
    expect(features.stageInvitationPending).toBe(true);

    // Clear state
    features.stageInvitationPending = false;

    // Second invite with same cmdId should be ignored
    handleSessionCommand('stage', {
      value: JSON.stringify({ action: 'invite', id: 'guest', _cmdId: 'unique-1' }),
    });
    expect(features.stageInvitationPending).toBe(false);

    // Invite with new cmdId should succeed
    handleSessionCommand('stage', {
      value: JSON.stringify({ action: 'invite', id: 'guest', _cmdId: 'unique-2' }),
    });
    expect(features.stageInvitationPending).toBe(true);

    // Flood with 105 unique commands to cover cache pruning logic
    for (let i = 0; i < 105; i++) {
      handleSessionCommand('stage', {
        value: JSON.stringify({ action: 'invite', id: 'guest', _cmdId: `unique-flood-${i}` }),
      });
    }
  });

  it('handles unknown command names', () => {
    handleSessionCommand('unknown', { value: '{}' });
  });

  it('mutes remote users in the conference store', () => {
    const conference = useConferenceStore();
    conference.addUser('peer');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'mute', id: 'peer' }) });
    expect(conference.users.peer.mute).toBe(true);
  });

  it('approves other users without clearing local lobby pending', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.localLobbyPending = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', id: 'guest' }) });
    expect(features.lobbyApproved.guest).toBe(true);
    expect(features.localLobbyPending).toBe(true);
  });

  it('ignores host commands while a join is claiming host', () => {
    const features = useSessionFeaturesStore();
    features.resetHostForJoin();
    handleSessionCommand('host', { value: JSON.stringify({ hostId: 'stale' }) });
    expect(features.hostId).toBe('');
  });

  it('ignores partial command payloads', () => {
    const features = useSessionFeaturesStore();
    features.setHost('existing');
    handleSessionCommand('host', { value: JSON.stringify({ hostId: 'other' }) });
    expect(features.hostId).toBe('existing');

    handleSessionCommand('lobby', { value: 'bad' });
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'wait' }) });
    handleSessionCommand('react', { value: JSON.stringify({ emoji: '👍' }) });
    handleSessionCommand('hand', { value: JSON.stringify({ id: 'u1' }) });
    handleSessionCommand('hand', { value: JSON.stringify({ raised: true }) });
    handleSessionCommand('pos', { value: JSON.stringify({ id: 'u1' }) });
    handleSessionCommand('poll', { value: 'null' });
    handleSessionCommand('notes', { value: JSON.stringify({}) });

    const conference = useConferenceStore();
    conference.addUser('u1');
    const leaveSpy = vi.spyOn(conference, 'leaveConference');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick', id: 'other' }) });
    expect(leaveSpy).not.toHaveBeenCalled();
  });

  it('ignores invalid payloads', () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    conference.addUser('u1');
    const before = { ...conference.users.u1.pos };
    handleSessionCommand('pos', { value: 'not-json' });
    expect(conference.users.u1.pos).toEqual(before);
    features.sharedNotes = 'unchanged';
    handleSessionCommand('notes', { value: 'not-json' });
    expect(features.sharedNotes).toBe('unchanged');
  });

  it('ignores name commands with blank or missing names', () => {
    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Original' });
    handleSessionCommand('name', { value: JSON.stringify({ id: 'u1', name: '   ' }) });
    handleSessionCommand('name', { value: JSON.stringify({ id: 'u1' }) });
    expect(conference.users.u1.user?._displayName).toBe('Original');
  });
});
