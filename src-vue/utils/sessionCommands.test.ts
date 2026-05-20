import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { handleSessionCommand } from './sessionCommands';

describe('handleSessionCommand', () => {
  beforeEach(() => setActivePinia(createPinia()));

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
  });

  it('handles lobby, poll, notes, and moderator actions', () => {
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
    handleSessionCommand('poll', { value: JSON.stringify(poll) });
    expect(features.activePoll?.question).toBe('Q?');

    handleSessionCommand('notes', { value: JSON.stringify({ text: 'hello' }) });
    expect(features.sharedNotes).toBe('hello');

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
      { value: JSON.stringify({ userId: 'u2', grants: { poll: true, stage: true } }) },
    );
    expect(features.grantsForUser('u2').poll).toBe(true);
    expect(features.grantsForUser('u2').stage).toBe(true);
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
        }),
      },
    );
    expect(conference.messages[0].text).toBe('new');
    expect(conference.messages[0].editedAt).toBe(500);
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
    conference.addUser('u1');
    const before = { ...conference.users.u1.pos };
    handleSessionCommand('pos', { value: 'not-json' });
    expect(conference.users.u1.pos).toEqual(before);
  });

  it('ignores name commands with blank or missing names', () => {
    const conference = useConferenceStore();
    conference.addUser('u1', { _displayName: 'Original' });
    handleSessionCommand('name', { value: JSON.stringify({ id: 'u1', name: '   ' }) });
    handleSessionCommand('name', { value: JSON.stringify({ id: 'u1' }) });
    expect(conference.users.u1.user?._displayName).toBe('Original');
  });
});
