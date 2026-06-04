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
  beforeEach(() => setActivePinia(createPinia()));

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

  it('claims host on join when host id is still empty', async () => {
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
    expect(features.hostId).toBe('solo');
    expect(cmdSpy).toHaveBeenCalledWith('host', JSON.stringify({ hostId: 'solo' }));
  });

  it('claims host on join when pendingHostClaim is set', async () => {
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
    expect(features.hostId).toBe('solo');
    expect(features.pendingHostClaim).toBe(false);
    expect(cmdSpy).toHaveBeenCalledWith('host', JSON.stringify({ hostId: 'solo' }));
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
    expect(cmdSpy).toHaveBeenCalledWith(
      'notes',
      JSON.stringify({ text: 'room notes' }),
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
    expect(features.localLobbyPending).toBe(true);
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('wait'));
  });
});
