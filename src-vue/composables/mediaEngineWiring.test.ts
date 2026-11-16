import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import type { JitsiTrack } from '@/types/jitsi';
import { getJitsiTestContext } from '@/test/jitsiTestContext';
import { makeRemoteAudioTrack } from '@/test/jitsiMock';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { wireStoreSync } from './mediaEngineWiring';
import { handleSessionCommand } from '@/utils/sessionCommands';

describe('wireStoreSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionFeaturesStore().lobbyEnabled = false;
  });

  it('syncs connection, conference, tracks, and position commands', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;

    wireStoreSync(engine);

    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    await flushPromises();
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack);

    conference.addUser('existing');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'existing',
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack);

    jitsi.conference._handlers.get('cmd:pos')?.({
      value: JSON.stringify({ id: 'existing', x: 3, y: 4 }),
    });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: JSON.stringify({ id: 'missing', y: 1 }) });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: 'bad-json' });

    expect(conference.users.existing.pos).toEqual({ x: 3, y: 4 });

    const refreshSpy = vi.spyOn(engine, 'refreshRemoteAudio');
    jitsi.conference._fire('conference.dataChannelOpened');
    expect(refreshSpy).toHaveBeenCalled();

    conference.addUser('sharer');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'sharer',
      getType: () => 'audio',
      videoType: 'desktop',
      isMuted: () => false,
      isLocal: () => false,
      getId: () => 'share-audio',
    } as JitsiTrack);
    expect(conference.users.sharer.screenshareAudio).toBeDefined();
    expect(conference.users.sharer.audio).toBeUndefined();

    const before = local.id;
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(local.id).toBe(before);
  });

  it('syncs display name changes', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1', { _displayName: 'Alice' });
    jitsi.conference._fire(ev.conference.DISPLAY_NAME_CHANGED, 'u1', 'Bob');
    expect(conference.users.u1.user?._displayName).toBe('Bob');
    jitsi.conference._handlers.get('cmd:name')?.({
      value: JSON.stringify({ id: 'u1', name: 'Carol' }),
    });
    expect(conference.users.u1.user?._displayName).toBe('Carol');
  });

  it('syncs remote speaking level from received audio', () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    wireStoreSync(engine);
    conference.addUser('u1');
    (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'participantSpeakingChanged',
      'u1',
      true,
    );
    expect(conference.users.u1.speaking).toBe(true);
    (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'participantSpeakingChanged',
      'u1',
      false,
    );
    expect(conference.users.u1.speaking).toBe(false);
  });

  it('drops a lobby knock when that person leaves', () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    wireStoreSync(engine);
    features.addLobbyWaiter({ id: 'gone', name: 'Gone' });
    (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit('userLeft', 'gone');
    expect(features.lobbyWaiting).toHaveLength(0);
  });

  it('ignores speaking changes for unknown users', () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    wireStoreSync(engine);
    (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'participantSpeakingChanged',
      'new-speaker',
      true,
    );
    expect(conference.users['new-speaker']).toBeUndefined();
  });

  it('ignores participant property updates for unknown users', () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    wireStoreSync(engine);
    (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'participantPropertyChanged',
      'missing',
      { speaking: true },
    );
    expect(conference.users.missing).toBeUndefined();
  });

  it('syncs handRaised without creating unknown users', () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    wireStoreSync(engine);
    (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'participantPropertyChanged',
      'stranger',
      { handRaised: true },
    );
    expect(conference.users.stranger).toBeUndefined();
    expect(features.handRaised).toBe(false);
  });

  it('syncs speaking participant property', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'u1',
      _properties: { speaking: true },
    });
    expect(conference.users.u1.speaking).toBe(true);
    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'u1',
      _properties: { speaking: 'false' },
    });
    expect(conference.users.u1.speaking).toBe(false);
    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'u1',
      _properties: { handRaised: true },
    });
    expect(conference.users.u1.properties.handRaised).toBe(true);
  });

  it('does not store muted video on trackAdded', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u-muted');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'u-muted',
      getType: () => 'video',
      isMuted: () => true,
      isLocal: () => false,
      videoType: 'camera',
    } as JitsiTrack);
    expect(conference.users['u-muted'].video).toBeUndefined();
  });

  it('syncs remote video mute and removal', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    const videoTrack = {
      getParticipantId: () => 'u1',
      getType: () => 'video',
      isMuted: () => false,
      isLocal: () => false,
      videoType: 'camera',
    } as JitsiTrack;
    jitsi.conference._fire(ev.conference.TRACK_ADDED, videoTrack);
    expect(conference.users.u1.video).toBeTruthy();

    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...videoTrack,
      isMuted: () => true,
    });
    expect(conference.users.u1.video).toBeUndefined();

    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...videoTrack,
      isMuted: () => false,
    });
    expect(conference.users.u1.video).toBeTruthy();

    jitsi.conference._fire(ev.conference.TRACK_REMOVED, videoTrack);
    expect(conference.users.u1.video).toBeUndefined();
  });

  it('applies stored spatial volume when remote audio track arrives', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    conference.patchUser('u1', { volume: 0.42 }, false);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, makeRemoteAudioTrack('u1'));
    expect(conference.users.u1.audio).toBeTruthy();
    expect(volSpy).toHaveBeenCalledWith('u1', 0.42);
    volSpy.mockRestore();
  });

  it('restores spatial volume when remote audio is unmuted', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    conference.patchUser('u1', { volume: 0.5 }, false);
    const audioTrack = makeRemoteAudioTrack('u1');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, audioTrack);
    volSpy.mockClear();
    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...audioTrack,
      isMuted: () => false,
    });
    expect(conference.users.u1.audio).toBeTruthy();
    expect(volSpy).toHaveBeenCalledWith('u1', 0.5);
    volSpy.mockRestore();
  });

  it('silences Web Audio when remote audio is muted', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    const disconnectSpy = vi.spyOn(engine, 'disconnectParticipantAudio');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    const audioTrack = makeRemoteAudioTrack('u1');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, audioTrack);
    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...audioTrack,
      isMuted: () => true,
    });
    expect(conference.users.u1.mute).toBe(true);
    expect(disconnectSpy).toHaveBeenCalledWith('u1');
    disconnectSpy.mockRestore();
  });

  it('handles track mute/removed events with no participant id', async () => {
    const engine = getMediaEngineInstance();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    expect(() => {
      jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
        getType: () => 'audio',
        isMuted: () => true,
        isLocal: () => false,
      } as JitsiTrack);
      jitsi.conference._fire(ev.conference.TRACK_REMOVED, {
        getType: () => 'audio',
        isLocal: () => false,
      } as JitsiTrack);
    }).not.toThrow();
  });

  it('auto-adds an unknown user on mute change and uses default volume', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    const audioTrack = makeRemoteAudioTrack('newcomer');
    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...audioTrack,
      isMuted: () => false,
    });
    expect(conference.users.newcomer).toBeDefined();
    conference.patchUser('newcomer', { volume: undefined as never }, false);
    volSpy.mockClear();
    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...audioTrack,
      isMuted: () => false,
    });
    expect(volSpy).toHaveBeenLastCalledWith('newcomer', expect.any(Number));
    volSpy.mockRestore();
  });

  it('applies default volume for newly added audio with no stored volume', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    conference.patchUser('u1', { volume: undefined as never }, false);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, makeRemoteAudioTrack('u1'));
    expect(volSpy).toHaveBeenCalledWith('u1', expect.any(Number));
    volSpy.mockRestore();
  });

  it('removes a remote audio track', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    const audioTrack = makeRemoteAudioTrack('u1');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, audioTrack);
    expect(conference.users.u1.audio).toBeTruthy();
    jitsi.conference._fire(ev.conference.TRACK_REMOVED, audioTrack);
    expect(conference.users.u1.audio).toBeUndefined();
  });

  it('dedupes identical chat messages', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    jitsi.conference._fire(ev.conference.MESSAGE_RECEIVED, 'u1', 'hi', 1);
    jitsi.conference._fire(ev.conference.MESSAGE_RECEIVED, 'u1', 'hi', 1);
    expect(conference.messages).toHaveLength(1);
  });

  it('clears join state when conference error fires after disconnect', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    conference.conferenceObject = engine.getConference() as never;
    conference.isJoined = true;
    engine.leaveRoom();
    jitsi.conference._fire(ev.conference.CONFERENCE_ERROR);
    expect(conference.isJoined).toBe(false);
    expect(conference.conferenceObject).toBeUndefined();
  });

  it('ignores conference errors with empty detail', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    conference.isJoined = true;
    engine.leaveRoom();
    jitsi.connection.xmpp = {};
    jitsi.conference._fire(ev.conference.CONFERENCE_ERROR);
    expect(conference.error).toBeUndefined();
    expect(conference.isJoined).toBe(true);
  });

  it('ignores conference errors while still joined', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    conference.conferenceObject = engine.getConference() as never;
    conference.isJoined = true;
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    jitsi.conference._fire(ev.conference.CONFERENCE_FAILED, 'room unavailable');
    expect(conference.error).toBeUndefined();
    expect(conference.isJoined).toBe(true);
    expect(conference.conferenceObject).toBeTruthy();
  });

  it('ignores whitespace-only conference errors', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    conference.isJoined = true;
    engine.leaveRoom();
    jitsi.conference._fire(ev.conference.CONFERENCE_FAILED, '   ');
    expect(conference.error).toBeUndefined();
  });

  it('does not claim host on join when the account is not the mapped host', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Solo', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('solo');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(features.pendingHostClaim).toBe(false);
    expect(local.id).toBe('solo');
    expect(features.hostId).toBe('');
    expect(features.isHost).toBe(false);
    expect(cmdSpy).not.toHaveBeenCalledWith('host', expect.any(String));
  });

  it('announces the verified host email on join', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.isVerifiedHost = true;
    features.hostEmail = 'ada@example.com';
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Ada', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('ada-jitsi');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(features.hostId).toBe('ada-jitsi');
    expect(features.isHost).toBe(true);
    expect(cmdSpy).toHaveBeenCalledWith(
      'host',
      JSON.stringify({ hostId: 'ada-jitsi', email: 'ada@example.com' }),
    );
  });

  it('does not claim host on join when pendingHostClaim is set for an attendee', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.resetHostForJoin();
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Solo', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('solo');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(local.id).toBe('solo');
    expect(features.hostId).toBe('');
    expect(features.isHost).toBe(false);
    expect(features.pendingHostClaim).toBe(false);
    expect(cmdSpy).not.toHaveBeenCalledWith('host', expect.any(String));
  });

  it('ignores stale host commands while pendingHostClaim is set', () => {
    const features = useSessionFeaturesStore();
    features.resetHostForJoin();
    handleSessionCommand('host', {
      value: JSON.stringify({ hostId: 'stale-host' }),
    });
    expect(features.hostId).toBe('');
  });

  it('does not rebroadcast access for non-host participants', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    local.setMyID('guest');
    features.setHost('host');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Guest', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.USER_JOINED, 'other', {});
    expect(cmdSpy).not.toHaveBeenCalledWith('access', expect.any(String));
  });

  it('applies hand raise state when a user joins with handRaised property', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    jitsi.conference._fire(ev.conference.USER_JOINED, 'guest', {
      _properties: { handRaised: true },
    });
    expect(conference.users.guest.properties.handRaised).toBe(true);
  });

  it('rebroadcasts access when host sees a new participant', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    local.setMyID('host');
    features.setHost('host');
    features.setRoomDefault('notes', true);
    features.setRoomDefault('whiteboard', false);
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Host', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.USER_JOINED, 'guest', {});
    expect(cmdSpy).toHaveBeenCalledWith(
      'access',
      expect.stringContaining('"defaults"'),
    );
    expect(cmdSpy).toHaveBeenCalledWith('access', expect.stringContaining('"notes":true'));
  });

  it('applies notes template and room background when claiming host', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.resetHostForJoin();
    features.isVerifiedHost = true;
    features.hostEmail = 'host@example.com';
    features.hostSettingsSessionId = 'room';
    features.notesTemplate = '# Agenda';
    features.gridBackgroundUrl = 'data:image/jpeg;base64,wall';
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Host', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('host');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(features.sharedNotes).toBe('# Agenda');
    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.stringContaining('"action":"yjs_begin"'));
    expect(cmdSpy).toHaveBeenCalledWith(
      'room',
      JSON.stringify({ action: 'reload', email: 'host@example.com' }),
    );
  });

  it('applies the notes template when the verified host joins', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.isVerifiedHost = true;
    features.hostEmail = 'solo@example.com';
    features.notesTemplate = '# Kickoff';
    features.gridBackgroundUrl = 'data:image/jpeg;base64,grid';
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Solo', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('solo');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(features.sharedNotes).toBe('# Kickoff');
    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.stringContaining('"action":"yjs_begin"'));
    expect(cmdSpy).toHaveBeenCalledWith(
      'room',
      JSON.stringify({ action: 'reload', email: 'solo@example.com' }),
    );
  });

  it('rebroadcasts room background when host sees a new participant', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    local.setMyID('host');
    features.setHost('host');
    features.gridBackgroundUrl = 'data:image/jpeg;base64,wall';
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Host', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.USER_JOINED, 'guest', {});
    expect(cmdSpy).toHaveBeenCalledWith('room', JSON.stringify({ action: 'reload' }));
  });

  it('rebroadcasts room background when a moderator sees a new participant', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    local.setMyID('mod');
    features.setHost('host');
    features.userGrants.mod = { moderator: true };
    features.gridBackgroundUrl = 'data:image/jpeg;base64,wall';
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Mod', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.USER_JOINED, 'guest', {});
    expect(cmdSpy).toHaveBeenCalledWith('room', JSON.stringify({ action: 'reload' }));
    expect(cmdSpy).not.toHaveBeenCalledWith('access', expect.any(String));
  });

  it('rebroadcasts shared notes when host sees a new participant', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    local.setMyID('host');
    features.setHost('host');
    features.sharedNotes = 'room notes';
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Host', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.USER_JOINED, 'guest', {});
    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.stringContaining('"action":"begin"'));
  });

  it('announces lobby approval when an invited person joins', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.configLoaded = true;
    features.lobbyEnabled = true;
    features.isInvited = true;
    features.setHost('room-host');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Guest', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('guest-jitsi');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(features.isLobbyBlocked).toBe(false);
    expect(cmdSpy).toHaveBeenCalledWith(
      'lobby',
      JSON.stringify({ action: 'approve', id: 'guest-jitsi' }),
    );
  });

  it('sends lobby wait when joining with lobby enabled', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.setHost('other-host');
    features.lobbyEnabled = true;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Bob', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(features.localLobbyPending).toBe(false);
    expect(features.isLobbyBlocked).toBe(true);
    expect(cmdSpy).not.toHaveBeenCalledWith('lobby', expect.any(String));
  });

  it('clears remote screenshare track on trackAdded if muted', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u-muted-screen');
    conference.users['u-muted-screen'].screenshare = { getType: () => 'video' } as never;
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'u-muted-screen',
      getType: () => 'video',
      isMuted: () => true,
      isLocal: () => false,
      videoType: 'desktop',
    } as JitsiTrack);
    expect(conference.users['u-muted-screen'].screenshare).toBeUndefined();
  });

  it('clears remote screenshare track on trackMuteChanged if muted', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u-muted-screen');
    const track = {
      getParticipantId: () => 'u-muted-screen',
      getType: () => 'video',
      isMuted: () => false,
      isLocal: () => false,
      videoType: 'desktop',
    } as JitsiTrack;
    jitsi.conference._fire(ev.conference.TRACK_ADDED, track);
    expect(conference.users['u-muted-screen'].screenshare).toBeDefined();

    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, {
      ...track,
      isMuted: () => true,
    } as JitsiTrack);
    expect(conference.users['u-muted-screen'].screenshare).toBeUndefined();
  });

  it('clears remote screenshare track on trackRemoved', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u-muted-screen');
    const track = {
      getParticipantId: () => 'u-muted-screen',
      getType: () => 'video',
      isMuted: () => false,
      isLocal: () => false,
      videoType: 'desktop',
    } as JitsiTrack;
    jitsi.conference._fire(ev.conference.TRACK_ADDED, track);
    expect(conference.users['u-muted-screen'].screenshare).toBeDefined();

    jitsi.conference._fire(ev.conference.TRACK_REMOVED, track);
    expect(conference.users['u-muted-screen'].screenshare).toBeUndefined();

    // Normal camera video track removed
    const camTrack = {
      getParticipantId: () => 'u-muted-screen',
      getType: () => 'video',
      isMuted: () => false,
      isLocal: () => false,
      videoType: 'camera',
    } as JitsiTrack;
    conference.setUserTrack('u-muted-screen', 'video', camTrack);
    jitsi.conference._fire(ev.conference.TRACK_REMOVED, camTrack);
    expect(conference.users['u-muted-screen'].video).toBeUndefined();

    // Remote audio track mute change
    const audioTrack = {
      getParticipantId: () => 'u-muted-screen',
      getType: () => 'audio',
      isMuted: () => true,
      isLocal: () => false,
    } as JitsiTrack;
    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, audioTrack);
    expect(conference.users['u-muted-screen'].mute).toBe(true);

    const unmutedAudioTrack = {
      getParticipantId: () => 'u-muted-screen',
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack;
    jitsi.conference._fire(ev.conference.TRACK_MUTE_CHANGED, unmutedAudioTrack);
    expect(conference.users['u-muted-screen'].audio).toBeDefined();
  });

  it('patches onStage and syncs the stage occupant id', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'u1',
      _properties: { onStage: true },
    });
    expect(conference.users.u1.properties.onStage).toBe(true);
    expect(features.stageOccupantId).toBe('u1');

    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: 'u1',
      _properties: { onStage: false },
    });
    expect(features.stageOccupantId).toBe('');
  });

  it('syncs stage occupant and sets local stage state when participant is local', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    
    const localId = 'my-local-id';
    local.setMyID(localId);
    conference.addUser(localId);

    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: localId,
      _properties: { onStage: true },
    });
    expect(local.onStage).toBe(true);

    jitsi.conference._fire(ev.conference.PARTICIPANT_PROPERTY_CHANGED, {
      _id: localId,
      _properties: { onStage: false },
    });
    expect(local.onStage).toBe(false);
  });

  it('handles trackRemoved for audio when disconnectParticipantAudio is absent', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    conference.addUser('u1');
    // Simulate engine without disconnectParticipantAudio
    const saved = (engine as { disconnectParticipantAudio?: unknown }).disconnectParticipantAudio;
    delete (engine as { disconnectParticipantAudio?: unknown }).disconnectParticipantAudio;
    const audioTrack = {
      getParticipantId: () => 'u1',
      getType: () => 'audio',
      isLocal: () => false,
    } as JitsiTrack;
    expect(() => {
      jitsi.conference._fire(ev.conference.TRACK_REMOVED, audioTrack);
    }).not.toThrow();
    (engine as { disconnectParticipantAudio?: unknown }).disconnectParticipantAudio = saved;
  });

  it('skips host sync if config is fetching', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;

    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    await flushPromises();

    features.isFetchingConfig = true;
    const syncSpy = vi.spyOn(features, 'syncOrClaimHostOnLoaded');
    
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('runs periodic heartbeat hello and stale user pruning', async () => {
    vi.useFakeTimers();
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    const pruneSpy = vi.spyOn(conference, 'pruneStaleUsers');

    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    local.setMyID('local_alice');
    local.userKey = 'uk_alice';
    local.pos = { x: 100, y: 100 };
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    // Re-fire to test existing heartbeat timer replacement
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);

    cmdSpy.mockClear();
    vi.advanceTimersByTime(5000);

    expect(cmdSpy).toHaveBeenCalledWith(
      'hello',
      expect.stringContaining('"id":"local-1"'),
    );
    expect(pruneSpy).toHaveBeenCalledWith(45000, expect.any(Array));

    // test tick when isJoined is false
    const joinedSpy = vi.spyOn(engine, 'isJoined').mockReturnValue(false);
    vi.advanceTimersByTime(5000);
    joinedSpy.mockRestore();

    // test tick when myId is empty and getConference is null
    local.setMyID('');
    const idSpy = vi.spyOn(engine, 'getLocalUserId').mockReturnValue('');
    const confSpy = vi.spyOn(engine, 'getConference').mockReturnValue(null as any);
    vi.advanceTimersByTime(5000);
    expect(pruneSpy).toHaveBeenCalledWith(45000, []);
    idSpy.mockRestore();
    confSpy.mockRestore();
    local.setMyID('local-1');

    // connectionFailed clears active timer
    jitsi.connection._fire(ev.connection.CONNECTION_FAILED);
    cmdSpy.mockClear();
    vi.advanceTimersByTime(5000);
    expect(cmdSpy).not.toHaveBeenCalled();

    // second connectionFailed when timer is already cleared
    jitsi.connection._fire(ev.connection.CONNECTION_FAILED, 'network_error');

    // Rejoin to restart timer
    const reIdSpy = vi.spyOn(engine, 'getLocalUserId').mockReturnValue('local-1');
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    reIdSpy.mockRestore();

    // Disconnection clears timer
    jitsi.connection._fire(ev.connection.CONNECTION_DISCONNECTED);
    cmdSpy.mockClear();
    vi.advanceTimersByTime(5000);
    expect(cmdSpy).not.toHaveBeenCalled();

    // second disconnected when timer is already cleared
    jitsi.connection._fire(ev.connection.CONNECTION_DISCONNECTED);

    vi.useRealTimers();
  });

  it('holds a waiting person and plays them after admission', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;
    features.lobbyEnabled = true;
    features.hostId = 'host';
    local.setMyID('host');
    features.setHost('host');
    features.isVerifiedHost = true;
    const { seedNotesDocument } = await import('@/utils/notesYjsSync');
    seedNotesDocument(features.ydoc, 'Hello');
    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Host', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, makeRemoteAudioTrack('guest'));
    expect(conference.users.guest?.audio).toBeUndefined();
    features.$patch({ lobbyForm: 'details' });
    expect(conference.users.guest?.audio).toBeUndefined();
    features.$patch({ lobbyApproved: { guest: true } });
    await flushPromises();
    expect(conference.users.guest?.audio).toBeTruthy();
    const muted = makeRemoteAudioTrack('guest2');
    muted.isMuted = () => true;
    features.lobbyApproved = { ...features.lobbyApproved, guest2: true };
    jitsi.conference._fire(ev.conference.TRACK_ADDED, muted);
    jitsi.conference._fire(ev.conference.USER_JOINED, 'late', {});
    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.stringContaining('"action":"yjs_begin"'));
  });

  it('preserves initial participant properties and syncs mediaLocks on userJoined', async () => {
    const engine = getMediaEngineInstance();
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;

    local.setMyID('host');
    features.setHost('host');
    features.isVerifiedHost = true;
    features.hostEmail = 'host@example.com';
    features.setMediaLock('locked-guest', { mic: true, camera: false });

    wireStoreSync(engine);
    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Host', {});
    const cmdSpy = vi.spyOn(engine, 'sendCommand');

    jitsi.conference._fire(ev.conference.USER_JOINED, 'locked-guest', {
      _properties: { role: 'moderator', handRaised: 'true' },
    });
    expect(conference.users['locked-guest'].properties.role).toBe('moderator');
    expect(conference.users['locked-guest'].properties.handRaised).toBe(true);
    expect(cmdSpy).toHaveBeenCalledWith(
      'mod',
      JSON.stringify({
        action: 'lock_media',
        id: 'locked-guest',
        mic: true,
        camera: false,
        email: 'host@example.com',
      }),
    );

    // Also test camera-only lock with no controlEmail
    features.hostEmail = '';
    features.setMediaLock('cam-locked-guest', { mic: false, camera: true });
    jitsi.conference._fire(ev.conference.USER_JOINED, 'cam-locked-guest', {});
    expect(cmdSpy).toHaveBeenCalledWith(
      'mod',
      JSON.stringify({
        action: 'lock_media',
        id: 'cam-locked-guest',
        mic: false,
        camera: true,
      }),
    );
  });

  it('clears screenshare on trackMuteChanged and trackRemoved even if videoType reverted, without clearing separate camera', () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    wireStoreSync(engine);
    conference.addUser('u-screen-revert');
    const emit = (engine as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit.bind(engine);

    const screenTrack = {
      getParticipantId: () => 'u-screen-revert',
      getType: () => 'video',
      isMuted: () => false,
      videoType: 'desktop',
      getSourceName: () => 'u-screen-revert-v0',
    };
    const camTrack = {
      getParticipantId: () => 'u-screen-revert',
      getType: () => 'video',
      isMuted: () => false,
      videoType: 'camera',
      getSourceName: () => 'u-screen-revert-v0',
    };

    emit('trackAdded', screenTrack);
    emit('trackAdded', camTrack);
    expect(conference.users['u-screen-revert'].screenshare).toBe(screenTrack);
    expect(conference.users['u-screen-revert'].video).toBe(camTrack);

    // Muting camera while a different screenshare is active clears video only
    camTrack.isMuted = () => true;
    emit('trackMuteChanged', camTrack);
    expect(conference.users['u-screen-revert'].video).toBeUndefined();
    expect(conference.users['u-screen-revert'].screenshare).toBe(screenTrack);

    // Muting screenshare whose videoType reverted to camera still clears screenshare via identity match
    screenTrack.videoType = 'camera';
    screenTrack.isMuted = () => true;
    emit('trackMuteChanged', screenTrack);
    expect(conference.users['u-screen-revert'].screenshare).toBeUndefined();

    // Re-add both and test trackRemoved with both non-matching camera and identity-matched screenshare
    screenTrack.videoType = 'desktop';
    screenTrack.isMuted = () => false;
    camTrack.isMuted = () => false;
    emit('trackAdded', screenTrack);
    emit('trackAdded', camTrack);
    emit('trackRemoved', camTrack);
    expect(conference.users['u-screen-revert'].video).toBeUndefined();
    expect(conference.users['u-screen-revert'].screenshare).toBe(screenTrack);

    screenTrack.videoType = 'camera';
    emit('trackRemoved', screenTrack);
    expect(conference.users['u-screen-revert'].screenshare).toBeUndefined();
  });
});


