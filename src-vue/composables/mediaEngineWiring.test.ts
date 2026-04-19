import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import type { JitsiTrack } from '@/types/jitsi';
import { getJitsiTestContext } from '@/test/jitsiTestContext';
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
