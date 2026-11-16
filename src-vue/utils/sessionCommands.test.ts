import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { encodeNotesForWire } from './notesSync';
import { encodeChatWireText } from './chatWireFormat';
import { handleSessionCommand } from './sessionCommands';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

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

    features.hostEmail = 'host@example.com';
    handleSessionCommand('host', {
      value: JSON.stringify({ hostId: 'host1', email: 'host@example.com' }),
    });
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
    features.hostId = 'other-host';

    // Non-host knock (no sound)
    features.isVerifiedHost = false;
    features.isVerifiedModerator = false;
    vi.mocked(playUiSound).mockClear();
    handleSessionCommand('lobby', {
      value: JSON.stringify({ enabled: true, action: 'wait', id: 'g1', name: 'Guest' }),
    });
    expect(features.lobbyEnabled).toBe(true);
    expect(features.lobbyWaiting[0]?.id).toBe('g1');
    expect(playUiSound).not.toHaveBeenCalled();

    // Host knock triggers lobbyKnock sound
    features.isVerifiedHost = true;
    vi.mocked(playUiSound).mockClear();
    handleSessionCommand('lobby', {
      value: JSON.stringify({ action: 'wait', id: 'g2', name: 'Guest 2' }),
    });
    expect(features.lobbyWaiting[1]?.id).toBe('g2');
    expect(playUiSound).toHaveBeenCalledWith('lobbyKnock');

    // Moderator knock triggers lobbyKnock sound
    features.isVerifiedHost = false;
    features.isVerifiedModerator = true;
    vi.mocked(playUiSound).mockClear();
    handleSessionCommand('lobby', {
      value: JSON.stringify({ action: 'wait', id: 'g3', name: 'Guest 3' }),
    });
    expect(features.lobbyWaiting[2]?.id).toBe('g3');
    expect(playUiSound).toHaveBeenCalledWith('lobbyKnock');
    features.isVerifiedModerator = false;

    features.localLobbyPending = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', id: 'me' }) });
    expect(features.lobbyApproved.me).toBe(true);
    expect(features.localLobbyPending).toBe(false);

    // Approve by userKey and all
    features.localLobbyPending = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', userKey: local.userKey }) });
    expect(features.localLobbyPending).toBe(false);

    local.setMyID('');
    features.localLobbyPending = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', userKey: local.userKey }) });
    expect(features.localLobbyPending).toBe(false);
    local.setMyID('me');

    features.localLobbyPending = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', id: 'all' }) });
    expect(features.localLobbyPending).toBe(false);

    // Reject by userKey and id
    features.localLobbyPending = true;
    features.lobbyRejected = false;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', userKey: local.userKey }) });
    expect(features.lobbyRejected).toBe(true);
    expect(features.localLobbyPending).toBe(false);

    features.localLobbyPending = true;
    features.lobbyRejected = false;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'me' }) });
    expect(features.lobbyRejected).toBe(true);
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

    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    handleSessionCommand('notes', { value: JSON.stringify({ action: 'yjs_request' }) });
    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.stringContaining('yjs_begin'));

    const doc2 = new Y.Doc();
    doc2.getXmlFragment('default').insert(0, [new Y.XmlText('yjs test')]);
    const update = Y.encodeStateAsUpdate(doc2);
    const base64 = btoa(String.fromCharCode(...update));
    handleSessionCommand('notes', { value: JSON.stringify({ action: 'yjs_update', update: base64 }) });
    expect(features.ydoc.getXmlFragment('default').toString()).toContain('yjs test');

    const doc3 = new Y.Doc();
    doc3.getXmlFragment('default').insert(0, [new Y.XmlText('yjs chunk test')]);
    const update3 = Y.encodeStateAsUpdate(doc3);
    const base64_3 = btoa(String.fromCharCode(...update3));
    handleSessionCommand('notes', { value: JSON.stringify({ action: 'yjs_begin', total: 1 }) });
    handleSessionCommand('notes', { value: JSON.stringify({ action: 'yjs_chunk', index: 0, data: base64_3 }) });
    expect(features.ydoc.getXmlFragment('default').toString()).toContain('yjs chunk test');

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

  it('delivers live chat posts once per message id', () => {
    const conference = useConferenceStore();
    const wire = encodeChatWireText('post-1', 'hello room');
    handleSessionCommand('chat', { value: JSON.stringify({ action: 'post', text: wire }) });
    expect(conference.messages).toHaveLength(0);
    handleSessionCommand('chat', { value: JSON.stringify({ action: 'post' }) }, 'peer');
    expect(conference.messages).toHaveLength(0);
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'post', text: wire, nr: 4 }) },
      'peer',
    );
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'post', text: wire, nr: 4 }) },
      'peer',
    );
    expect(conference.messages).toHaveLength(1);
    expect(conference.messages[0]).toMatchObject({ id: 'peer', text: 'hello room', nr: 4, messageId: 'post-1' });
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'post', text: encodeChatWireText('post-2', 'no nr') }) },
      'peer',
    );
    expect(conference.messages[1]).toMatchObject({ text: 'no nr', nr: -1 });
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

    // Mismatched senderId vs editorId
    handleSessionCommand(
      'chat',
      {
        value: JSON.stringify({
          action: 'edit',
          messageId: 'm1',
          text: 'spoofed',
          editedAt: 500,
          editorId: 'u1',
        }),
      },
      'attacker',
    );
    expect(conference.messages[0].text).toBe('old');
  });

  it('handles chat delete command for moderators and authors, rejects for unauthorized users', () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    features.setHost('host');

    conference.messages = [
      { id: 'user1', text: 'hello', nr: 1, messageId: 'm1' },
      { id: 'user2', text: 'world', nr: 2, messageId: 'm2' },
    ];

    // Unauthorized user trying to delete user1's message
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'delete', messageId: 'm1', senderId: 'user3' }) },
      'user3',
    );
    expect(conference.messages).toHaveLength(2);

    // Author deleting their own message
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'delete', messageId: 'm1', senderId: 'user1' }) },
      'user1',
    );
    expect(conference.messages[0].messageId).toBe('m2');

    // Moderator deleting user2's message
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'delete', messageId: 'm2', senderId: 'host' }) },
      'host',
    );
    expect(conference.messages).toHaveLength(0);

    // Delete by nr only using data.senderId without top-level senderId
    conference.messages = [{ id: 'user1', text: 'hello', nr: 5 }];
    handleSessionCommand('chat', {
      value: JSON.stringify({ action: 'delete', nr: 5, senderId: 'user1' }),
    });
    expect(conference.messages).toHaveLength(0);

    // Delete from unauthorized participant is rejected
    conference.messages = [{ id: 'user1', text: 'hello', nr: 6 }];
    handleSessionCommand(
      'chat',
      { value: JSON.stringify({ action: 'delete', nr: 6 }) },
      'user3',
    );
    expect(conference.messages).toHaveLength(1);
  });

  it('handles mod_change command for proposing, approving, and rejecting changes', () => {
    const features = useSessionFeaturesStore();
    const stroke = { id: 's1', color: '#000', width: 2, points: [{ x: 1, y: 1 }] };

    // Propose change with explicit timestamp and full details
    handleSessionCommand(
      'mod_change',
      {
        value: JSON.stringify({
          action: 'propose',
          id: 'mc-1',
          type: 'whiteboard',
          authorId: 'user1',
          authorName: 'User 1',
          payload: stroke,
          timestamp: 1234567,
        }),
      },
      'user1',
    );
    expect(features.pendingModerationChanges).toHaveLength(1);

    // Approve change
    handleSessionCommand(
      'mod_change',
      { value: JSON.stringify({ action: 'approve', id: 'mc-1' }) },
    );
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.whiteboardStrokes).toHaveLength(1);

    // Propose and reject change with omitted authorId and authorName
    handleSessionCommand(
      'mod_change',
      {
        value: JSON.stringify({
          action: 'propose',
          id: 'mc-2',
          type: 'notes',
          payload: 'draft notes',
        }),
      },
    );
    handleSessionCommand(
      'mod_change',
      { value: JSON.stringify({ action: 'reject', id: 'mc-2' }) },
    );
    expect(features.pendingModerationChanges).toHaveLength(0);

    // Unauthorized participant attempting to approve or reject is ignored
    handleSessionCommand(
      'mod_change',
      {
        value: JSON.stringify({
          action: 'propose',
          id: 'mc-unauth',
          type: 'notes',
          payload: 'pending notes',
        }),
      },
    );
    expect(features.pendingModerationChanges).toHaveLength(1);

    // Non-moderator tries to approve -> rejected/ignored
    handleSessionCommand(
      'mod_change',
      { value: JSON.stringify({ action: 'approve', id: 'mc-unauth' }) },
      'guest-attacker',
    );
    expect(features.pendingModerationChanges).toHaveLength(1);

    // Non-moderator tries to reject -> rejected/ignored
    handleSessionCommand(
      'mod_change',
      { value: JSON.stringify({ action: 'reject', id: 'mc-unauth' }) },
      'guest-attacker',
    );
    expect(features.pendingModerationChanges).toHaveLength(1);

    // Clean up
    features.rejectModerationChange('mc-unauth');

    // Invalid commands handled gracefully
    handleSessionCommand('mod_change', { value: 'not-json' });
    handleSessionCommand('mod_change', { value: JSON.stringify({}) });
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

  it('covers defensive checks for empty first value in stage command cache pruning', () => {
    const local = useLocalStore();
    local.setMyID('guest');
    
    // Flood with 101 items first
    for (let i = 0; i < 101; i++) {
      handleSessionCommand('stage', {
        value: JSON.stringify({ action: 'settings', stagePromotionEnabled: true, _cmdId: `prune-flood-${i}` }),
      });
    }
    
    // Now mock Set.prototype.values to return undefined
    vi.spyOn(Set.prototype, 'values').mockImplementationOnce(function (this: any) {
      return {
        next: () => ({ done: true, value: undefined }),
        [Symbol.iterator]() { return this; }
      } as any;
    });
    
    handleSessionCommand('stage', {
      value: JSON.stringify({ action: 'settings', stagePromotionEnabled: true, _cmdId: 'prune-trigger' }),
    });
  });

  it('skips applying stage layout command when local user is the stage occupant', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('occupant-id');
    features.stageOccupantId = 'occupant-id';
    
    features.stageLayout.scale = 1.0;
    
    handleSessionCommand('stage', {
      value: JSON.stringify({ action: 'layout', layout: { scale: 1.5, expanded: true } }),
    });
    
    expect(features.stageLayout.scale).toBe(1.0);
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

  it('rejects other users without clearing local lobby pending', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.localLobbyPending = true;
    features.addLobbyWaiter({ id: 'guest', name: 'Guest' });
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'guest' }) });
    expect(features.lobbyWaiting).toHaveLength(0);
    expect(features.localLobbyPending).toBe(true);
    expect(features.lobbyRejected).toBe(false);
  });

  it('rejects self and clears local lobby pending', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.localLobbyPending = true;
    features.addLobbyWaiter({ id: 'me', name: 'Me' });
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'me' }) });
    expect(features.lobbyWaiting).toHaveLength(0);
    expect(features.localLobbyPending).toBe(false);
    expect(features.lobbyRejected).toBe(true);
  });

  it('lets the knocker cancel and ignores a deny from someone who is not host or moderator', () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    features.hostId = 'host';
    features.addLobbyWaiter({ id: 'guest', name: 'Guest' });
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'cancel', id: 'guest' }) }, 'other');
    expect(features.lobbyWaiting).toHaveLength(1);
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'cancel', id: 'guest' }) }, 'guest');
    expect(features.lobbyWaiting).toHaveLength(0);

    features.addLobbyWaiter({ id: 'guest', name: 'Guest' });
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'approve', id: 'guest' }) }, 'stranger');
    expect(features.lobbyApproved.guest).toBeFalsy();
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'guest' }) }, 'stranger');
    expect(features.lobbyWaiting).toHaveLength(1);
    features.hostId = 'database-host';
    features.hostEmail = 'host@uat.test';
    const local = useLocalStore();
    local.setMyID('guest');
    features.localLobbyPending = true;
    handleSessionCommand(
      'lobby',
      { value: JSON.stringify({ action: 'reject', id: 'guest', email: 'host@uat.test' }) },
      'jitsi-host',
    );
    expect(features.lobbyRejected).toBe(true);
    features.lobbyRejected = false;
    features.localLobbyPending = true;
    handleSessionCommand(
      'lobby',
      { value: JSON.stringify({ action: 'approve', id: 'guest', email: 'host@uat.test' }) },
      'jitsi-host',
    );
    expect(features.lobbyApproved.guest).toBe(true);
    expect(features.localLobbyPending).toBe(false);
    features.hostId = 'host';
    features.localLobbyPending = false;
    features.lobbyRejected = false;
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'guest' }) }, 'host');
    expect(features.lobbyWaiting).toHaveLength(0);

    features.addLobbyWaiter({ id: 'guest', name: 'Guest' });
    features.userGrants = { mod: { moderator: true, notes: false, whiteboard: false, poll: false, chat: true } };
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'guest' }) }, 'mod');
    expect(features.lobbyWaiting).toHaveLength(0);

    features.addLobbyWaiter({ id: 'guest', name: 'Guest' });
    conference.addUser('mod-role');
    conference.users['mod-role'].properties = { role: 'moderator' };
    handleSessionCommand('lobby', { value: JSON.stringify({ action: 'reject', id: 'guest' }) }, 'mod-role');
    expect(features.lobbyWaiting).toHaveLength(0);
  });

  it('ignores host commands while a join is claiming host', () => {
    const features = useSessionFeaturesStore();
    features.resetHostForJoin();
    handleSessionCommand('host', { value: JSON.stringify({ hostId: 'stale' }) });
    expect(features.hostId).toBe('');
  });

  it('ignores host commands when meetingExists is true', () => {
    const features = useSessionFeaturesStore();
    features.meetingExists = true;
    features.hostId = 'db-host';
    handleSessionCommand('host', { value: JSON.stringify({ hostId: 'other-host' }) });
    expect(features.hostId).toBe('db-host');
  });

  it('accepts a host announcement only when the email matches the meeting host', () => {
    const features = useSessionFeaturesStore();
    features.pendingHostClaim = false;
    features.meetingExists = true;
    features.hostEmail = 'Host@Example.com';
    features.setHost('db-host');
    handleSessionCommand('host', {
      value: JSON.stringify({ hostId: 'jitsi-stranger', email: 'other@example.com' }),
    });
    expect(features.hostId).toBe('db-host');
    handleSessionCommand('host', {
      value: JSON.stringify({ hostId: 'jitsi-host', email: 'host@example.com' }),
    });
    expect(features.hostId).toBe('jitsi-host');
  });

  it('ignores a host announcement from a verified host client', () => {
    const features = useSessionFeaturesStore();
    features.pendingHostClaim = false;
    features.isVerifiedHost = true;
    features.hostEmail = 'host@example.com';
    features.setHost('local-jitsi');
    handleSessionCommand('host', {
      value: JSON.stringify({ hostId: 'someone-else', email: 'host@example.com' }),
    });
    expect(features.hostId).toBe('local-jitsi');
  });

  it('ignores access updates broadcast by someone other than the host', () => {
    const features = useSessionFeaturesStore();
    features.setHost('host-1');
    handleSessionCommand(
      'access',
      {
        value: JSON.stringify({
          defaults: { notes: true, whiteboard: true, poll: true, moderator: false, chat: true },
        }),
      },
      'host-1',
    );
    expect(features.roomDefaults.notes).toBe(true);
    handleSessionCommand(
      'access',
      {
        value: JSON.stringify({
          defaults: { notes: false, whiteboard: false, poll: false, moderator: false, chat: true },
          userId: 'host-1',
          grants: {},
        }),
      },
      'other',
    );
    expect(features.roomDefaults.notes).toBe(true);
    expect(features.roomDefaults.whiteboard).toBe(true);
    expect(features.roomDefaults.poll).toBe(true);
    features.hostId = '';
    features.hostEmail = 'host@example.com';
    features.roomDefaults = { ...features.roomDefaults, whiteboard: false };
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ whiteboard: true }) },
      'someone',
    );
    expect(features.roomDefaults.whiteboard).toBe(false);
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ whiteboard: true, email: 'host@example.com' }) },
      'someone',
    );
    expect(features.roomDefaults.whiteboard).toBe(true);
    features.userGrants.mod = { moderator: true };
    features.roomDefaults = { ...features.roomDefaults, notes: false };
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ notes: true }) },
      'mod',
    );
    expect(features.roomDefaults.notes).toBe(false);
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ notes: true, userId: 'att', grants: { notes: false, moderator: true } }) },
      'mod',
    );
    expect(features.roomDefaults.notes).toBe(false);
    expect(features.userGrants.att?.notes).toBe(false);
    expect(features.userGrants.att?.moderator).toBeUndefined();
    features.moderatorEmails = ['moderator@example.com'];
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ notes: true, email: 'other@example.com' }) },
      'email-mod',
    );
    expect(features.roomDefaults.notes).toBe(false);
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ userId: 'att', grants: { whiteboard: false }, email: 'moderator@example.com' }) },
      'email-mod',
    );
    expect(features.roomDefaults.notes).toBe(false);
    expect(features.userGrants.att?.whiteboard).toBe(false);
    const conference = useConferenceStore();
    conference.addUser('bridge-mod');
    conference.users['bridge-mod'].properties = { role: 'moderator' };
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ notes: true, userId: 'att', grants: { poll: false } }) },
      'bridge-mod',
    );
    expect(features.roomDefaults.notes).toBe(false);
    expect(features.userGrants.att?.poll).toBe(false);

    conference.addUser('jitsi-mod');
    (conference.users['jitsi-mod'] as any).role = 'moderator';
    handleSessionCommand(
      'access',
      { value: JSON.stringify({ userId: 'att', grants: { chat: false } }) },
      'jitsi-mod',
    );
    expect(features.userGrants.att?.chat).toBe(false);
  });

  it('keeps meeting-wide controls with the host and moderation with host or moderator', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('me');
    features.setHost('host');
    features.lobbyEnabled = true;
    handleSessionCommand('lobby', { value: JSON.stringify({ enabled: false }) }, 'guest');
    expect(features.lobbyEnabled).toBe(true);
    features.hostEmail = 'host@example.com';
    handleSessionCommand('lobby', { value: JSON.stringify({ enabled: false, email: 'host@example.com' }) }, 'guest');
    expect(features.lobbyEnabled).toBe(false);

    features.gridBackgroundUrl = 'keep';
    handleSessionCommand('room', { value: JSON.stringify({ action: 'clear' }) }, 'guest');
    expect(features.gridBackgroundUrl).toBe('keep');
    features.userGrants.mod = { moderator: true };
    handleSessionCommand('room', { value: JSON.stringify({ action: 'clear' }) }, 'mod');
    expect(features.gridBackgroundUrl).toBe('');

    features.stagePromotionEnabled = true;
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'settings', stagePromotionEnabled: false }) }, 'guest');
    expect(features.stagePromotionEnabled).toBe(true);
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'promote', id: 'me' }) }, 'guest');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'invite', id: 'me' }) }, 'guest');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'demote', id: 'host' }) }, 'guest');
    expect(features.stageOccupantId).toBe('');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'settings', stagePromotionEnabled: false }) }, 'host');
    expect(features.stagePromotionEnabled).toBe(false);
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'invite', id: 'me' }) }, 'host');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'promote', id: 'me' }) }, 'host');
    expect(features.stageOccupantId).toBe('me');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'demote', id: 'me' }) }, 'me');
    expect(features.stageOccupantId).toBe('');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'promote', id: 'me' }) }, 'host');
    handleSessionCommand('stage', { value: JSON.stringify({ action: 'demote', id: 'me' }) }, 'mod');
    expect(features.stageOccupantId).toBe('');

    const leaveSpy = vi.spyOn(conference, 'leaveConference');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick', id: 'me' }) }, 'guest');
    expect(leaveSpy).not.toHaveBeenCalled();
    local.setMyID('host');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick', id: 'host' }) }, 'mod');
    expect(leaveSpy).not.toHaveBeenCalled();
    features.userGrants.otherMod = { moderator: true };
    local.setMyID('otherMod');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick', id: 'otherMod' }) }, 'mod');
    expect(leaveSpy).not.toHaveBeenCalled();
    conference.addUser('peer');
    conference.users.peer.properties = { role: 'moderator' };
    local.setMyID('peer');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'mute', id: 'peer' }) }, 'mod');
    expect(conference.users.peer.mute).not.toBe(true);
    local.setMyID('att');
    const toggleSpy = vi.spyOn(local, 'toggleMute').mockResolvedValue(undefined);
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'mute', id: 'att' }) }, 'mod');
    expect(toggleSpy).toHaveBeenCalled();
    local.setMyID('att2');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick', id: 'att2' }) }, 'host');
    expect(leaveSpy).toHaveBeenCalled();
  });

  it('ignores partial command payloads', () => {
    const features = useSessionFeaturesStore();
    features.setHost('existing');
    handleSessionCommand('host', { value: JSON.stringify({ hostId: 'other' }) });
    expect(features.hostId).toBe('existing');

    handleSessionCommand('host', { value: 'bad' });
    handleSessionCommand('host', { value: '{}' });
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

  it('processes config commands to toggle features in real time', () => {
    const features = useSessionFeaturesStore();
    features.allowParticipantRecording = false;
    features.lobbyEnabled = false;
    features.stagePromotionEnabled = false;

    handleSessionCommand('config', {
      value: JSON.stringify({
        allowParticipantRecording: true,
        lobbyEnabled: true,
        stagePromotionEnabled: true,
      })
    });
    expect(features.allowParticipantRecording).toBe(true);
    expect(features.lobbyEnabled).toBe(true);
    expect(features.stagePromotionEnabled).toBe(true);

    handleSessionCommand('config', {
      value: JSON.stringify({
        lobbyEnabled: false,
      })
    });
    expect(features.allowParticipantRecording).toBe(true);
    expect(features.lobbyEnabled).toBe(false);
    expect(features.stagePromotionEnabled).toBe(true);

    handleSessionCommand('config', {
      value: JSON.stringify({
        allowParticipantRecording: false,
      })
    });
    expect(features.allowParticipantRecording).toBe(false);
    expect(features.lobbyEnabled).toBe(false);
    expect(features.stagePromotionEnabled).toBe(true);

    // Rejects config updates from non-host senders when hostId is known
    features.hostId = 'host_user_1';
    handleSessionCommand(
      'config',
      { value: JSON.stringify({ allowParticipantRecording: true }) },
      'imposter_user',
    );
    expect(features.allowParticipantRecording).toBe(false);

    // Accepts config updates from the actual host
    handleSessionCommand(
      'config',
      { value: JSON.stringify({ allowParticipantRecording: true }) },
      'host_user_1',
    );
    expect(features.allowParticipantRecording).toBe(true);

    features.userGrants.mod = { moderator: true };
    features.allowParticipantRecording = false;
    handleSessionCommand(
      'config',
      { value: JSON.stringify({ allowParticipantRecording: true }) },
      'mod',
    );
    expect(features.allowParticipantRecording).toBe(false);
    features.hostEmail = 'host@example.com';
    handleSessionCommand(
      'config',
      { value: JSON.stringify({ allowParticipantRecording: true, email: 'host@example.com' }) },
      'mod',
    );
    expect(features.allowParticipantRecording).toBe(true);

    handleSessionCommand('config', { value: 'not-json' });
    expect(features.allowParticipantRecording).toBe(true);

    handleSessionCommand('config', { value: JSON.stringify({ lobbyForm: 'details' }) });
    expect(features.lobbyForm).toBe('details');
    handleSessionCommand('config', { value: JSON.stringify({ lobbyForm: 'name' }) });
    expect(features.lobbyForm).toBe('name');
    handleSessionCommand('config', { value: JSON.stringify({ lobbyForm: 'other' }) });
    expect(features.lobbyForm).toBe('name');
  });

  it('prevents non-moderators from starting polls or clearing whiteboard', () => {
    const features = useSessionFeaturesStore();
    features.activePoll = undefined;
    features.setHost('host1');
    handleSessionCommand('poll', { value: JSON.stringify({ id: 'poll-1', question: 'q', options: ['a'] }) }, 'guest1');
    expect(features.activePoll).toBeUndefined();

    features.whiteboardStrokes = [{ x: 1, y: 1, isStart: true, color: '#000', size: 1 }];
    handleSessionCommand('wb', { value: JSON.stringify({ action: 'clear' }) }, 'guest1');
    expect(features.whiteboardStrokes.length).toBe(1);
  });

  it('handles poll_req create, approve, reject, and cancel actions', () => {
    const features = useSessionFeaturesStore();
    features.isVerifiedModerator = true;
    features.panel = '';

    const req = {
      id: 'pr-test-1',
      question: 'Next agenda?',
      options: ['Design', 'Engineering'],
      requesterId: 'user-1',
      requesterName: 'Alice',
      createdAt: 1000,
    };

    // create action
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'create', request: req }),
    });
    expect(features.pendingPollRequests).toHaveLength(1);
    expect(features.pendingPollRequests[0].id).toBe('pr-test-1');
    expect(features.hasUnreadPoll).toBe(true);

    // approve action removes request
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'approve', requestId: 'pr-test-1' }),
    });
    expect(features.pendingPollRequests).toHaveLength(0);

    // reject action removes request and sets notice if it was local user's request
    features.addPollRequest(req);
    features.myPendingPollRequestId = 'pr-test-1';
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'reject', requestId: 'pr-test-1' }),
    });
    expect(features.pendingPollRequests).toHaveLength(0);
    expect(features.pollRequestNotice).toContain('declined by a moderator');

    // cancel action removes request
    features.addPollRequest(req);
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'cancel', requestId: 'pr-test-1' }),
    });
    expect(features.pendingPollRequests).toHaveLength(0);

    // reject action when myPendingPollRequestId differs
    features.addPollRequest(req);
    features.myPendingPollRequestId = 'other-req';
    features.pollRequestNotice = '';
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'reject', requestId: 'pr-test-1' }),
    });
    expect(features.pollRequestNotice).toBe('');

    // create action when local user is attendee (not mod/host)
    features.isVerifiedModerator = false;
    features.isVerifiedHost = false;
    features.pollActivitySeq = 0;
    features.pollSeenSeq = 0;
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'create', request: req }),
    });
    expect(features.hasUnreadPoll).toBe(false);

    // create action when moderator has panel open
    features.isVerifiedModerator = true;
    features.panel = 'poll';
    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'create', request: { ...req, id: 'pr-2' } }),
    });

    // invalid payloads and no-op actions
    handleSessionCommand('poll_req', { value: 'not-json' });
    handleSessionCommand('poll_req', { value: JSON.stringify({}) });
    handleSessionCommand('poll_req', { value: JSON.stringify({ action: 'create' }) });
    handleSessionCommand('poll_req', { value: JSON.stringify({ action: 'approve' }) });
    handleSessionCommand('poll_req', { value: JSON.stringify({ action: 'reject' }) });
    handleSessionCommand('poll_req', { value: JSON.stringify({ action: 'cancel' }) });
    handleSessionCommand('poll_req', { value: JSON.stringify({ action: 'other' }) });
  });

  it('handles hello and hello_req presence commands', () => {
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('local_me');
    local.pos = { x: 100, y: 100 };
    local.userKey = 'uk_local';

    // Ignore missing id or self id
    handleSessionCommand('hello', { value: JSON.stringify({}) });
    handleSessionCommand('hello', { value: JSON.stringify({ id: 'local_me' }) });
    expect(conference.users['local_me']).toBeUndefined();

    // Valid remote hello
    handleSessionCommand('hello', {
      value: JSON.stringify({
        id: 'peer_1',
        userKey: 'uk_peer_1',
        pos: { x: 500, y: 500 },
        name: 'Peer 1',
      }),
    });
    expect(conference.users['peer_1']).toBeDefined();
    expect(conference.users['peer_1'].pos).toEqual({ x: 500, y: 500 });
    expect(conference.users['peer_1'].user?._displayName).toBe('Peer 1');
    const features = useSessionFeaturesStore();
    features.admitParticipantEmail('', 'a@b.c');
    features.admitParticipantEmail('blank', '   ');
    features.guestEmails = ['guest@uat.test'];
    features.lobbyEnabled = true;
    handleSessionCommand('hello', {
      value: JSON.stringify({ id: 'peer_invited', email: 'guest@uat.test', name: 'Invited' }),
    });
    expect(features.lobbyApproved.peer_invited).toBe(true);
    handleSessionCommand('hello', {
      value: JSON.stringify({ id: 'peer_stranger', email: 'stranger@uat.test', name: 'Stranger' }),
    });
    expect(features.lobbyApproved.peer_stranger).toBeFalsy();
    features.hostEmail = 'host@uat.test';
    handleSessionCommand('hello', {
      value: JSON.stringify({ id: 'peer_host', email: 'host@uat.test' }),
    });
    expect(features.lobbyApproved.peer_host).toBe(true);

    // Hello with minimal data (no userKey, no pos, no name)
    handleSessionCommand('hello', {
      value: JSON.stringify({ id: 'peer_minimal' }),
    });
    expect(conference.users['peer_minimal']).toBeDefined();

    // Ignore hello when senderId does not match claimed id
    handleSessionCommand(
      'hello',
      { value: JSON.stringify({ id: 'peer_spoofed', name: 'Spoofed' }) },
      'actual_sender',
    );
    expect(conference.users['peer_spoofed']).toBeUndefined();

    // Hello when user already exists in conference.users
    handleSessionCommand('hello', {
      value: JSON.stringify({ id: 'peer_1', name: 'Peer 1 Updated', userKey: 'uk_peer_1_new' }),
    });
    expect(conference.users['peer_1'].user?._displayName).toBe('Peer 1 Updated');
    expect(conference.users['peer_1'].userKey).toBe('uk_peer_1_new');

    // Hello when user already exists but without userKey
    handleSessionCommand('hello', {
      value: JSON.stringify({ id: 'peer_minimal', name: 'Minimal 2' }),
    });
    expect(conference.users['peer_minimal'].user?._displayName).toBe('Minimal 2');

    // hello_req from self or empty is ignored
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    handleSessionCommand('hello_req', { value: JSON.stringify({}) });
    handleSessionCommand('hello_req', { value: JSON.stringify({ from: 'local_me' }) });
    expect(cmdSpy).not.toHaveBeenCalled();

    // hello_req when local.id is empty is ignored
    local.setMyID('');
    handleSessionCommand('hello_req', { value: JSON.stringify({ from: 'peer_2' }) });
    expect(cmdSpy).not.toHaveBeenCalled();
    local.setMyID('local_me');

    // hello_req from remote responds with hello
    handleSessionCommand('hello_req', { value: JSON.stringify({ from: 'peer_2' }) });
    expect(cmdSpy).toHaveBeenCalledWith(
      'hello',
      expect.stringContaining('"id":"local_me"'),
    );
    cmdSpy.mockRestore();
  });

  it('blocks commands when feature is disabled by host room-wide', () => {
    const features = useSessionFeaturesStore();
    features.enabledFeatures = {
      notes: false,
      whiteboard: false,
      poll: false,
      stage: false,
      chat: false,
    };

    handleSessionCommand('chat', {
      value: JSON.stringify({ action: 'edit', messageId: 'm1', text: 't', editedAt: 1, editorId: 'e1' }),
    });

    handleSessionCommand('notes', { value: JSON.stringify({ action: 'begin', total: 1 }) });
    expect(features.sharedNotes).toBe('');

    handleSessionCommand('wb', {
      value: JSON.stringify({ action: 'stroke', stroke: { id: 's1', color: '#000', width: 2, points: [] } }),
    });
    expect(features.whiteboardStrokes).toHaveLength(0);

    handleSessionCommand('poll', {
      value: JSON.stringify({ action: 'create', poll: { id: 'p1', question: 'Q', options: [] } }),
    });
    expect(features.activePoll).toBeNull();

    handleSessionCommand('poll_req', {
      value: JSON.stringify({ action: 'create', request: { id: 'pr1', question: 'Q', options: [] } }),
    });
    expect(features.pendingPollRequests).toHaveLength(0);

    handleSessionCommand('stage', { value: JSON.stringify({ action: 'promote', id: 'u1' }) });
    expect(features.stageOccupantId).toBe('');

    handleSessionCommand('mod_change', {
      value: JSON.stringify({ action: 'propose', id: 'mc_wb', type: 'whiteboard', payload: 'stroke' }),
    });
    handleSessionCommand('mod_change', {
      value: JSON.stringify({ action: 'propose', id: 'mc1', type: 'notes', payload: 'text' }),
    });
    expect(features.pendingModerationChanges).toHaveLength(0);
  });

  it('handles kick of remote user, camera_off, lock_media, hello host email claim, and invited presenter stage promote', () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');

    local.setMyID('me');
    features.setHost('host');
    features.pendingHostClaim = false;
    features.isVerifiedHost = false;
    features.hostEmail = 'owner@example.com';

    // 1. hello claims hostId when email matches hostEmail
    handleSessionCommand(
      'hello',
      { value: JSON.stringify({ id: 'real-host', email: 'Owner@Example.com', name: 'Owner' }) },
      'real-host',
    );
    expect(features.hostId).toBe('real-host');
    expect(conference.users['real-host'].email).toBe('owner@example.com');

    // 2. kick remote participant (present & missing)
    conference.addUser('kick-me');
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'kick', id: 'kick-me' }) },
      'real-host',
    );
    expect(conference.users['kick-me']).toBeUndefined();
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'kick', id: 'already-gone' }) },
      'real-host',
    );

    // 3. mute when local is already muted + mute remote participant (present & missing)
    local.mute = true;
    const toggleMuteSpy = vi.spyOn(local, 'toggleMute').mockResolvedValue(undefined);
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'mute', id: 'me' }) },
      'real-host',
    );
    expect(toggleMuteSpy).not.toHaveBeenCalled();
    expect(features.stageMessage).toBe('A moderator muted your microphone.');

    conference.addUser('peer-audio');
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'mute', id: 'peer-audio' }) },
      'real-host',
    );
    expect(conference.users['peer-audio'].mute).toBe(true);
    expect(volSpy).toHaveBeenCalledWith('peer-audio', 0);
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'mute', id: 'missing-peer' }) },
      'real-host',
    );

    // 4. camera_off local (active & already off) and remote (present & missing)
    const toggleCamSpy = vi.spyOn(local, 'toggleCamera').mockResolvedValue(undefined);
    local.cameraOff = false;
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'camera_off', id: 'me' }) },
      'real-host',
    );
    expect(toggleCamSpy).toHaveBeenCalledTimes(1);
    expect(features.stageMessage).toBe('A moderator turned off your camera.');

    local.cameraOff = true;
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'camera_off', id: 'me' }) },
      'real-host',
    );
    expect(toggleCamSpy).toHaveBeenCalledTimes(1);

    conference.addUser('peer-cam');
    conference.users['peer-cam'].video = { getType: () => 'video' } as never;
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'camera_off', id: 'peer-cam' }) },
      'real-host',
    );
    expect(conference.users['peer-cam'].video).toBeUndefined();
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'camera_off', id: 'missing-cam' }) },
      'real-host',
    );

    // 5. lock_media local (both, unlock, mic-only, camera-only, repeated no-op)
    local.mute = false;
    local.cameraOff = false;
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', mic: true, camera: true }) },
      'real-host',
    );
    expect(toggleMuteSpy).toHaveBeenCalledTimes(1);
    expect(toggleCamSpy).toHaveBeenCalledTimes(2);
    expect(features.stageMessage).toBe('Your microphone and camera were locked by a moderator.');

    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', mic: false, camera: false }) },
      'real-host',
    );
    expect(features.stageMessage).toBe('A moderator unlocked your media controls.');

    local.mute = true;
    local.cameraOff = true;
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', mic: true }) },
      'real-host',
    );
    expect(features.stageMessage).toBe('Your microphone was locked by a moderator.');

    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', mic: false }) },
      'real-host',
    );
    expect(features.stageMessage).toBe('A moderator unlocked your media controls.');

    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', camera: true }) },
      'real-host',
    );
    expect(features.stageMessage).toBe('Your camera was locked by a moderator.');

    // Repeated camera: true does not overwrite message; unlocking camera-only hits (!nextCam && prev.camera)
    features.stageMessage = 'keep';
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', camera: true }) },
      'real-host',
    );
    expect(features.stageMessage).toBe('keep');
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'me', camera: false }) },
      'real-host',
    );
    expect(features.stageMessage).toBe('A moderator unlocked your media controls.');

    // Invalid/incomplete mod payloads hit line 470 branches
    handleSessionCommand('mod', { value: JSON.stringify({}) }, 'real-host');
    handleSessionCommand('mod', { value: JSON.stringify({ action: 'kick' }) }, 'real-host');

    // 6. lock_media remote (locked, unlocked, missing) + unknown mod action
    conference.addUser('peer-lock');
    conference.users['peer-lock'].video = { getType: () => 'video' } as never;
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'peer-lock', mic: true, camera: true }) },
      'real-host',
    );
    expect(conference.users['peer-lock'].mute).toBe(true);
    expect(conference.users['peer-lock'].video).toBeUndefined();

    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'peer-lock', mic: false, camera: false }) },
      'real-host',
    );
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'lock_media', id: 'missing-lock', mic: true }) },
      'real-host',
    );
    handleSessionCommand(
      'mod',
      { value: JSON.stringify({ action: 'unknown_mod', id: 'me' }) },
      'real-host',
    );

    // 7. stage promote by invited presenter (remote & local pending invite)
    features.enabledFeatures.stage = true;
    features.invitedStageUserId = 'invited-peer';
    handleSessionCommand(
      'stage',
      { value: JSON.stringify({ action: 'promote', id: 'invited-peer' }) },
      'invited-peer',
    );
    expect(features.stageOccupantId).toBe('invited-peer');

    features.stageOccupantId = '';
    features.invitedStageUserId = '';
    features.stageInvitationPending = true;
    handleSessionCommand(
      'stage',
      { value: JSON.stringify({ action: 'promote', id: 'me' }) },
      'me',
    );
    expect(features.stageOccupantId).toBe('me');

    // 8. lobby action: 'invite' enforces sender role and adds valid string emails
    handleSessionCommand(
      'lobby',
      { value: JSON.stringify({ action: 'invite', emails: ['spoof@example.com'] }) },
      'untrusted-peer',
    );
    expect(features.guestEmails).not.toContain('spoof@example.com');

    handleSessionCommand(
      'lobby',
      { value: JSON.stringify({ action: 'invite', emails: [123, null] }) },
      'real-host',
    );
    expect(features.guestEmails).toEqual([]);

    handleSessionCommand(
      'lobby',
      { value: JSON.stringify({ action: 'invite', emails: ['invited@example.com', 42] }) },
      'real-host',
    );
    expect(features.guestEmails).toEqual(['invited@example.com']);
  });
});
