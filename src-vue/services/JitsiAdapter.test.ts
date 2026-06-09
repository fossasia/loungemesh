import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { JitsiAdapter } from './JitsiAdapter';
import { installJitsiMock, makeRemoteAudioTrack } from '@/test/jitsiMock';
import {
  decodeXmppCommandValue,
  encodeXmppCommandValue,
  XMPP_COMMAND_WIRE_PREFIX,
} from '@/utils/xmppCommandWire';

describe('JitsiAdapter', () => {
  let mock: ReturnType<typeof installJitsiMock>;
  let adapter: JitsiAdapter;

  beforeEach(() => {
    mock = installJitsiMock();
    adapter = new JitsiAdapter();
  });

  afterEach(() => {
    adapter.dispose();
    mock.cleanup();
    vi.unstubAllEnvs();
  });

  it('throws when JitsiMeetJS is missing', () => {
    mock.cleanup();
    const a = new JitsiAdapter();
    expect(() => a.init()).toThrow('JitsiMeetJS not found');
  });

  it('connects and emits connected', async () => {
    const onConnected = vi.fn();
    adapter.on('connected', onConnected);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    expect(onConnected).toHaveBeenCalled();
    expect(adapter.isConnected()).toBe(true);
  });

  it('blocks lib-jitsi unload listeners during connection construction', async () => {
    const unloadHandler = vi.fn();
    const pagehideHandler = vi.fn();
    mock.jsMeet.JitsiConnection = vi.fn(function JitsiConnection() {
      window.addEventListener('unload', unloadHandler);
      window.addEventListener('pagehide', pagehideHandler);
      return mock.connection;
    }) as never;
    await adapter.connect();
    window.dispatchEvent(new Event('unload'));
    window.dispatchEvent(new Event('pagehide'));
    expect(unloadHandler).not.toHaveBeenCalled();
    expect(pagehideHandler).toHaveBeenCalled();
    window.removeEventListener('pagehide', pagehideHandler);
  });

  it('suppresses TURN credential discovery when no TURN service is configured', async () => {
    const original = mock.connection.jingle?.getStunAndTurnCredentials;
    const nestedOriginal = mock.connection.xmpp?.connection?.jingle?.getStunAndTurnCredentials;
    await adapter.connect();
    expect(mock.connection.jingle?.getStunAndTurnCredentials).not.toBe(original);
    expect(mock.connection.xmpp?.connection?.jingle?.getStunAndTurnCredentials).not.toBe(nestedOriginal);
    expect(() => mock.connection.jingle?.getStunAndTurnCredentials?.()).not.toThrow();
  });

  it('keeps TURN credential discovery enabled when configured', async () => {
    vi.stubEnv('VITE_DISABLE_STUN_TURN_DISCOVERY', 'false');
    const original = mock.connection.jingle?.getStunAndTurnCredentials;
    const nestedOriginal = mock.connection.xmpp?.connection?.jingle?.getStunAndTurnCredentials;
    await adapter.connect();
    expect(mock.connection.jingle?.getStunAndTurnCredentials).toBe(original);
    expect(mock.connection.xmpp?.connection?.jingle?.getStunAndTurnCredentials).toBe(nestedOriginal);
  });

  it('connects when lib-jitsi exposes no jingle helper yet', async () => {
    mock.connection.jingle = undefined;
    await adapter.connect();
    expect(mock.connection.connect).toHaveBeenCalled();
  });

  it('emits connectionFailed with xmpp message', async () => {
    const onFail = vi.fn();
    adapter.on('connectionFailed', onFail);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_FAILED);
    expect(onFail).toHaveBeenCalled();
  });

  it('emits default connectionFailed when xmpp detail is empty', async () => {
    mock.connection.xmpp = { lastErrorMsg: '   ' };
    const onFail = vi.fn();
    adapter.on('connectionFailed', onFail);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_FAILED);
    expect(onFail).toHaveBeenCalledWith('connection_failed');
  });

  it('reuses connection and calls connect when not connected', async () => {
    await adapter.connect();
    adapter.disconnect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_DISCONNECTED);
    await adapter.connect();
    expect(mock.connection.connect).toHaveBeenCalledTimes(2);
  });

  it('calls connect on existing connection instance', async () => {
    await adapter.connect();
    expect(mock.connection.connect).toHaveBeenCalledTimes(1);
    await adapter.connect();
    expect(mock.connection.connect).toHaveBeenCalledTimes(2);
  });

  it('skips connect when connection is already established', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    const calls = mock.connection.connect.mock.calls.length;
    await adapter.connect();
    expect(mock.connection.connect).toHaveBeenCalledTimes(calls);
  });

  it('ignores conference errors after the room is joined', async () => {
    const onError = vi.fn();
    adapter.on('conferenceError', onError);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'Alice', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
    mock.connection.xmpp = { lastErrorMsg: 'transient glitch' };
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_ERROR);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not emit conference error when xmpp has no detail', async () => {
    const onError = vi.fn();
    adapter.on('conferenceError', onError);
    mock.connection.xmpp = {};
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'Alice', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_ERROR);
    expect(onError).not.toHaveBeenCalled();
  });

  it('uses connection xmpp detail for conference errors', async () => {
    const onError = vi.fn();
    adapter.on('conferenceError', onError);
    mock.connection.xmpp = { lastErrorMsg: 'room join failed' };
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'Alice', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_ERROR);
    expect(onError).toHaveBeenCalledWith('room join failed');
  });

  it('joins conference and handles events', async () => {
    const events = {
      joined: vi.fn(),
      userJoined: vi.fn(),
      userLeft: vi.fn(),
      message: vi.fn(),
      track: vi.fn(),
      props: vi.fn(),
      command: vi.fn(),
    };
    adapter.on('conferenceJoined', events.joined);
    adapter.on('userJoined', events.userJoined);
    adapter.on('userLeft', events.userLeft);
    adapter.on('messageReceived', events.message);
    adapter.on('trackAdded', events.track);
    adapter.on('participantPropertyChanged', events.props);
    adapter.on('command', events.command);

    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'Alice', {});

    const ev = mock.jsMeet.events.conference;
    mock.conference._fire(ev.CONFERENCE_JOINED);
    mock.conference._fire(ev.USER_JOINED, 'u2', { name: 'Bob' });
    mock.conference._fire(ev.MESSAGE_RECEIVED, 'u2', 'hi', 1);
    mock.conference._fire(ev.PARTICIPANT_PROPERTY_CHANGED, { _id: 'u2', _properties: { onStage: true } });
    mock.conference._fire(ev.PARTICIPANT_PROPERTY_CHANGED, { _id: undefined, _properties: { onStage: true } });
    mock.conference._fire(ev.PARTICIPANT_PROPERTY_CHANGED, { _id: 'u3' });
    const audioTrack = makeRemoteAudioTrack('u2');
    mock.conference._fire(ev.TRACK_ADDED, audioTrack);
    adapter.setParticipantVolume('u2', 0.25);
    mock.conference._handlers.get('cmd:pos')?.({ value: JSON.stringify({ id: 'u2', x: 1, y: 2 }) });
    mock.conference._fire(ev.USER_LEFT, 'u2');

    expect(events.joined).toHaveBeenCalled();
    expect(events.userJoined).toHaveBeenCalled();
    expect(events.message).toHaveBeenCalled();
    expect(events.track).toHaveBeenCalled();
    expect(events.props).toHaveBeenCalled();
    expect(events.command).toHaveBeenCalled();
    expect(events.userLeft).toHaveBeenCalled();
    expect(adapter.isJoined()).toBe(true);
  });

  it('skips join when conference already exists', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'Alice', {});
    await adapter.joinRoom('room', 'Alice', {});
    expect(mock.connection.initJitsiConference).toHaveBeenCalledTimes(1);
  });

  it('throws when joining without connection', async () => {
    await expect(adapter.joinRoom('r', 'A', {})).rejects.toThrow('not ready');
  });

  it('retries conference join after focus disconnect', async () => {
    vi.useFakeTimers();
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference.join.mockClear();
    mock.conference._fire(
      mock.jsMeet.events.conference.CONFERENCE_FAILED,
      'conference.focusDisconnected',
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect(mock.conference.join).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not retry join after focus failure when already joined', async () => {
    vi.useFakeTimers();
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
    mock.conference.join.mockClear();
    mock.conference._fire(
      mock.jsMeet.events.conference.CONFERENCE_FAILED,
      'focus disconnected',
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect(mock.conference.join).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('skips focus retry when conference reference was cleared', async () => {
    vi.useFakeTimers();
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(
      mock.jsMeet.events.conference.CONFERENCE_FAILED,
      'focus disconnected',
    );
    adapter.leaveRoom();
    mock.conference.join.mockClear();
    await vi.advanceTimersByTimeAsync(1500);
    expect(mock.conference.join).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('swallows join errors during focus retry', async () => {
    vi.useFakeTimers();
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference.join.mockImplementation(() => {
      throw new Error('join boom');
    });
    mock.conference._fire(
      mock.jsMeet.events.conference.CONFERENCE_FAILED,
      'focus error',
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect(mock.conference.join).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles conference error and failed paths', async () => {
    const onError = vi.fn();
    adapter.on('conferenceError', onError);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    const ev = mock.jsMeet.events.conference;
    mock.conference._fire(ev.CONFERENCE_ERROR);
    expect(onError).toHaveBeenCalled();
    await adapter.joinRoom('room2', 'A', {});
    mock.conference._fire(ev.CONFERENCE_FAILED, undefined);
    mock.conference._fire(ev.CONFERENCE_FAILED, 'other-error');
    expect(onError).toHaveBeenCalledTimes(3);
  });

  it('handles auth failure with token refresh', async () => {
    const refresh = vi.fn().mockResolvedValue('new-jwt');
    adapter.onTokenExpired(refresh);
    const onExpired = vi.fn();
    const onError = vi.fn();
    adapter.on('tokenExpired', onExpired);
    adapter.on('conferenceError', onError);

    await adapter.connect({ jwt: 'old' });
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_FAILED, 'authentication required');
    await Promise.resolve();
    expect(onExpired).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('covers conference error detail and audio without stream', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.connection.xmpp = { lastErrorMsg: 'connection error' };
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_ERROR);
    mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, {
      isLocal: () => false,
      getType: () => 'audio',
      getParticipantId: () => 'no-stream',
      getOriginalStream: () => undefined,
    });
    expect(adapter.isJoined()).toBe(false);
  });

  it('handleTokenExpired is a no-op without refresh callback', async () => {
    const onExpired = vi.fn();
    adapter.on('tokenExpired', onExpired);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_FAILED, 'authentication required');
    await Promise.resolve();
    expect(onExpired).toHaveBeenCalled();
  });

  it('emits token_refresh_failed when refresh returns null', async () => {
    adapter.onTokenExpired(vi.fn().mockResolvedValue(null));
    const onError = vi.fn();
    adapter.on('conferenceError', onError);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_FAILED, 'not-authorized');
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith('token_refresh_failed');
  });

  it('ignores local tracks and non-audio tracks', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    const ev = mock.jsMeet.events.conference;
    mock.conference._fire(ev.CONFERENCE_JOINED);
    mock.conference._fire(ev.TRACK_ADDED, { isLocal: () => true, getType: () => 'video' });
    mock.conference._fire(ev.TRACK_ADDED, { isLocal: () => false, getType: () => 'video' });
    mock.conference._fire(ev.TRACK_ADDED, {
      isLocal: () => false,
      getType: () => 'audio',
      getParticipantId: () => undefined,
    });
    expect(adapter.isJoined()).toBe(true);
  });

  it('manages local tracks and conference commands', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);

    const tracks = await adapter.createLocalTracks(['audio']);
    expect(mock.jsMeet.createLocalTracks).toHaveBeenCalledWith(
      expect.objectContaining({ devices: ['audio'] }),
    );
    await adapter.addLocalTrack(tracks[0]);

    await adapter.createLocalTracks(['desktop']);
    expect(mock.jsMeet.createLocalTracks).toHaveBeenCalledWith(
      expect.objectContaining({ devices: ['desktop'] }),
    );

    await adapter.createLocalTracks([]);
    expect(mock.jsMeet.createLocalTracks).toHaveBeenCalledWith(
      expect.objectContaining({ devices: ['video'] }),
    );
    await adapter.replaceLocalTrack(tracks[0], tracks[0]);
    adapter.setDisplayName('A');
    adapter.setLocalParticipantProperty('k', 'v');
    adapter.sendTextMessage('hello');
    adapter.sendCommand('pos', '{"x":1}');
    adapter.setReceiverConstraints({
      colibriClass: 'x',
      selectedSources: [],
      lastN: 0,
      onStageSources: [],
      defaultConstraints: { maxHeight: 200 },
      constraints: {},
    });
    expect(adapter.getLocalUserId()).toBe('local-1');
    expect(adapter.getConference()).toBe(mock.conference);
    expect(adapter.sendTextMessage('hello')).toBe(true);
  });

  it('encodes session commands for safe XMPP transport', async () => {
    const onCommand = vi.fn();
    adapter.on('command', onCommand);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'Alice', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);

    const payload = JSON.stringify({
      action: 'chunk',
      index: 0,
      data: 'data:image/jpeg;base64,abc',
    });
    adapter.sendCommand('room', payload);
    const sent = vi.mocked(mock.conference.sendCommand).mock.calls.at(-1)?.[1]?.value;
    expect(sent?.startsWith(XMPP_COMMAND_WIRE_PREFIX)).toBe(true);
    expect(decodeXmppCommandValue(sent!)).toBe(payload);

    mock.conference._handlers.get('cmd:room')?.({
      value: encodeXmppCommandValue(JSON.stringify({ action: 'clear' })),
    });
    expect(onCommand).toHaveBeenCalledWith('room', {
      value: JSON.stringify({ action: 'clear' }),
    });

    mock.conference._handlers.get('cmd:stage')?.({
      value: encodeXmppCommandValue(JSON.stringify({ action: 'promote', id: 'guest' })),
    });
    expect(onCommand).toHaveBeenCalledWith('stage', {
      value: JSON.stringify({ action: 'promote', id: 'guest' }),
    });
  });

  it('returns false when sending chat without a conference', async () => {
    expect(adapter.sendTextMessage('nope')).toBe(false);
  });

  it('returns false when sendTextMessage throws', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
    vi.mocked(mock.conference.sendTextMessage).mockImplementation(() => {
      throw new Error('chat failed');
    });
    expect(adapter.sendTextMessage('boom')).toBe(false);
  });

  it('disconnects and removes listeners', async () => {
    const cb = vi.fn();
    adapter.on('disconnected', cb);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    adapter.off('disconnected', cb);
    adapter.disconnect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_DISCONNECTED);
    expect(cb).not.toHaveBeenCalled();
    expect(adapter.isConnected()).toBe(false);
  });

  it('init is idempotent', () => {
    adapter.init();
    adapter.init();
    expect(mock.jsMeet.init).toHaveBeenCalledTimes(1);
    expect(mock.jsMeet.init).toHaveBeenCalledWith({
      disableAudioLevels: true,
      enableWindowOnErrorHandler: false,
    });
    expect(mock.jsMeet.setLogLevel).toHaveBeenCalledWith('off');
  });

  it('init uses error log level when media debug is enabled', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const debugAdapter = new JitsiAdapter();
    debugAdapter.init();
    expect(mock.jsMeet.setLogLevel).toHaveBeenCalledWith('error');
    vi.unstubAllEnvs();
  });

  it('reuses AudioContext for multiple remote audio tracks', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
    const ev = mock.jsMeet.events.conference;
    mock.conference._fire(ev.TRACK_ADDED, {
      isLocal: () => false,
      getType: () => 'audio',
      getParticipantId: () => 'a1',
      getOriginalStream: () => ({}),
    });
    mock.conference._fire(ev.TRACK_ADDED, {
      isLocal: () => false,
      getType: () => 'audio',
      getParticipantId: () => 'a2',
      getOriginalStream: () => ({}),
    });
    expect(adapter.isJoined()).toBe(true);
  });

  it('uses empty conference options when none are provided', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', null as never);
    expect(mock.connection.initJitsiConference).toHaveBeenCalledTimes(1);
  });

  it('handles mute, removal and display-name edge cases', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    const ev = mock.jsMeet.events.conference;
    mock.conference._fire(ev.CONFERENCE_JOINED);

    mock.conference._fire(ev.TRACK_MUTE_CHANGED, { isLocal: () => true, getType: () => 'audio' });
    mock.conference._fire(ev.TRACK_MUTE_CHANGED, {
      isLocal: () => false,
      getType: () => 'audio',
      isMuted: () => true,
      getParticipantId: () => 'm1',
    });
    mock.conference._fire(ev.TRACK_MUTE_CHANGED, {
      isLocal: () => false,
      getType: () => 'audio',
      isMuted: () => true,
      getParticipantId: () => undefined,
    });
    mock.conference._fire(ev.TRACK_MUTE_CHANGED, makeRemoteAudioTrack('m2'));
    mock.conference._fire(ev.TRACK_MUTE_CHANGED, { isLocal: () => false, getType: () => 'video' });

    mock.conference._fire(ev.TRACK_REMOVED, { isLocal: () => true, getType: () => 'audio' });
    mock.conference._fire(ev.TRACK_REMOVED, {
      isLocal: () => false,
      getType: () => 'audio',
      getParticipantId: () => 'r1',
    });
    mock.conference._fire(ev.TRACK_REMOVED, {
      isLocal: () => false,
      getType: () => 'audio',
      getParticipantId: () => undefined,
    });
    mock.conference._fire(ev.TRACK_REMOVED, { isLocal: () => false, getType: () => 'video' });

    const onName = vi.fn();
    adapter.on('displayNameChanged', onName);
    mock.conference._fire(ev.DISPLAY_NAME_CHANGED, 'u9', undefined);
    mock.conference._fire(ev.DISPLAY_NAME_CHANGED, 'u9', '   ');
    expect(onName).not.toHaveBeenCalled();
    mock.conference._fire(ev.DISPLAY_NAME_CHANGED, 'u9', 'Zed');
    expect(onName).toHaveBeenCalledWith('u9', 'Zed');
  });

  it('emits tracks supplied by a joining participant', async () => {
    const onTrack = vi.fn();
    adapter.on('trackAdded', onTrack);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    const ev = mock.jsMeet.events.conference;
    mock.conference._fire(ev.USER_JOINED, 'u5', {
      getTracks: () => [
        { isLocal: () => true, getType: () => 'audio' },
        makeRemoteAudioTrack('p-audio'),
        { isLocal: () => false, getType: () => 'video' },
        { isLocal: () => false, getType: () => 'audio', isMuted: () => true },
      ],
    });
    expect(onTrack).toHaveBeenCalledTimes(3);
  });

  it('skips existing-track emission when the conference has no participant API', async () => {
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    (mock.conference as unknown as { getParticipants?: unknown }).getParticipants = undefined;
    expect(() =>
      mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED),
    ).not.toThrow();
    expect(adapter.isJoined()).toBe(true);
  });

  it('resumePlayback resumes only a suspended AudioContext', () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    class SuspendedCtx {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      resume = resume;
      close = vi.fn();
      createGain = vi.fn();
      createMediaStreamSource = vi.fn();
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', SuspendedCtx);
    try {
      adapter.resumePlayback();
      expect(resume).toHaveBeenCalled();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }

    const runningResume = vi.fn();
    class RunningCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = runningResume;
      close = vi.fn();
      createGain = vi.fn();
      createMediaStreamSource = vi.fn();
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    try {
      const a2 = new JitsiAdapter();
      a2.resumePlayback();
      expect(runningResume).not.toHaveBeenCalled();
      a2.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores non-audio or muted tracks when wiring remote audio', () => {
    const wire = (adapter as unknown as { wireRemoteAudioTrack: (t: unknown) => void })
      .wireRemoteAudioTrack;
    expect(() =>
      wire.call(adapter, { getType: () => 'video', isMuted: () => false }),
    ).not.toThrow();
  });

  it('reconnects gain nodes on AudioContext resume and guards stale nodes', async () => {
    const created: Array<{
      connect: ReturnType<typeof vi.fn>;
      gain: { setTargetAtTime: ReturnType<typeof vi.fn> };
    }> = [];
    let instance: { state: string; onstatechange: (() => void) | null } | undefined;
    class CapturingCtx {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      onstatechange: (() => void) | null = null;
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => {
        const g = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1, setTargetAtTime: vi.fn() } };
        created.push(g);
        return g;
      });
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
      constructor() {
        instance = this as unknown as { state: string; onstatechange: (() => void) | null };
      }
    }
    vi.stubGlobal('AudioContext', CapturingCtx);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      const ev = mock.jsMeet.events.conference;
      mock.conference._fire(ev.CONFERENCE_JOINED);
      adapter.resumePlayback();

      mock.conference._fire(ev.TRACK_ADDED, makeRemoteAudioTrack('a1'));
      const handlerA = instance!.onstatechange!;
      const gainA = created[created.length - 1];
      adapter.setParticipantVolume('a1', 1.5);
      expect(gainA.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.015);
      adapter.setParticipantVolume('a1', -0.5);
      expect(gainA.gain.value).toBe(0);
      expect(gainA.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
      handlerA();
      expect(gainA.connect).toHaveBeenCalledTimes(1);
      instance!.state = 'running';
      handlerA();
      expect(gainA.connect).toHaveBeenCalledTimes(2);

      instance!.state = 'suspended';
      mock.conference._fire(ev.TRACK_ADDED, makeRemoteAudioTrack('a2'));
      const handlerB = instance!.onstatechange!;
      const gainB = created[created.length - 1];
      mock.conference._fire(ev.TRACK_REMOVED, {
        isLocal: () => false,
        getType: () => 'audio',
        getParticipantId: () => 'a2',
      });
      instance!.state = 'running';
      handlerB();
      expect(gainB.connect).toHaveBeenCalledTimes(1);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('wires remote audio when the MediaStream arrives after TRACK_ADDED', async () => {
    vi.useFakeTimers();
    const createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
    class MockAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      close = vi.fn();
      resume = vi.fn();
      createMediaStreamSource = createMediaStreamSource;
      createGain = vi.fn(() => ({ connect: vi.fn(), gain: { value: 1, setTargetAtTime: vi.fn() } }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('JitsiMeetJS', {
      ...mock.jsMeet,
      events: {
        ...mock.jsMeet.events,
        track: {
          TRACK_STREAMING_STATUS_CHANGED: 'track.streamingStatusChanged',
          TRACK_MUTE_CHANGED: 'track.trackMuteChanged',
        },
      },
    });
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
      adapter.resumePlayback();

      const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
      const stream = {
        getAudioTracks: () => [audio],
        getTracks: () => [audio],
      } as unknown as MediaStream;
      let attached = false;
      const remoteTrack = {
        getType: () => 'audio',
        getParticipantId: () => 'ff-remote',
        isLocal: () => false,
        isMuted: () => false,
        mute: vi.fn(),
        unmute: vi.fn(),
        attach: vi.fn((el: HTMLAudioElement) => {
          if (!attached) return;
          el.srcObject = stream;
        }),
        detach: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, remoteTrack);
      expect(createMediaStreamSource).not.toHaveBeenCalled();

      attached = true;
      vi.advanceTimersByTime(100);
      expect(createMediaStreamSource).toHaveBeenCalledTimes(1);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('resumes suspended AudioContext when wiring remote audio', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    class MockAudioContext {
      state = 'suspended';
      resume = resume;
      destination = {};
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createGain = vi.fn(() => ({ connect: vi.fn(), gain: { value: 1 } }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', MockAudioContext);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, {
        isLocal: () => false,
        getType: () => 'audio',
        getParticipantId: () => 'remote-a',
        getOriginalStream: () => ({}),
      });
      expect(resume).not.toHaveBeenCalled();
      adapter.resumePlayback();
      expect(resume).toHaveBeenCalled();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('wires remote audio without resume handler when AudioContext is already running', async () => {
    class RunningAudioContext {
      state = 'running';
      destination = {};
      currentTime = 0;
      onstatechange: (() => void) | null = null;
      resume = vi.fn();
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningAudioContext);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      mock.conference._fire(mock.jsMeet.events.conference.CONFERENCE_JOINED);
      adapter.resumePlayback();
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, makeRemoteAudioTrack('running-a'));
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to element volume when Web Audio routing fails', async () => {
    class FailingCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      close = vi.fn();
      resume = vi.fn();
      createMediaStreamSource() {
        throw new Error('web-audio-unavailable');
      }
      createGain = vi.fn();
      createAnalyser = vi.fn();
    }
    vi.stubGlobal('AudioContext', FailingCtx);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(
        mock.jsMeet.events.conference.TRACK_ADDED,
        makeRemoteAudioTrack('fallback-user'),
      );
      adapter.setParticipantVolume('fallback-user', 0.6);
      const el = document.querySelector(
        'audio[data-loungemesh-participant="fallback-user"]',
      ) as HTMLAudioElement | null;
      expect(el?.volume).toBe(0.6);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reuses the hidden audio element when rewiring the same participant', async () => {
    class RunningCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      close = vi.fn();
      resume = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      const track = makeRemoteAudioTrack('reuse-audio');
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, track);
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_REMOVED, track);
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, makeRemoteAudioTrack('reuse-audio'));
      expect(
        document.querySelectorAll('audio[data-loungemesh-participant="reuse-audio"]').length,
      ).toBe(1);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips wiring when the remote track has no participant id', async () => {
    const createMediaStreamSource = vi.fn();
    class RunningCtx {
      state = 'running';
      destination = {};
      close = vi.fn();
      createMediaStreamSource = createMediaStreamSource;
      createGain = vi.fn(() => ({ connect: vi.fn(), gain: { value: 1 } }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, {
        getType: () => 'audio',
        isLocal: () => false,
        isMuted: () => false,
      });
      expect(createMediaStreamSource).not.toHaveBeenCalled();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('tolerates detach failures when removing participant audio', async () => {
    class RunningCtx {
      state = 'running';
      destination = {};
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    const track = makeRemoteAudioTrack('detach-fail');
    track.detach = vi.fn(() => {
      throw new Error('detach failed');
    });
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, track);
      expect(() =>
        mock.conference._fire(mock.jsMeet.events.conference.TRACK_REMOVED, track),
      ).not.toThrow();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores element volume updates when the fallback element is missing', async () => {
    class FailingCtx {
      state = 'running';
      destination = {};
      close = vi.fn();
      createMediaStreamSource() {
        throw new Error('web-audio-unavailable');
      }
      createGain = vi.fn();
      createAnalyser = vi.fn();
    }
    vi.stubGlobal('AudioContext', FailingCtx);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(
        mock.jsMeet.events.conference.TRACK_ADDED,
        makeRemoteAudioTrack('no-el'),
      );
      const internal = adapter as unknown as {
        elementVolumeFallback: Set<string>;
        remoteAudioElements: Map<string, HTMLAudioElement>;
      };
      internal.elementVolumeFallback.add('ghost');
      internal.remoteAudioElements.delete('ghost');
      expect(() => adapter.setParticipantVolume('ghost', 0.25)).not.toThrow();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('records non-Error failures when Web Audio routing throws', async () => {
    class FailingCtx {
      state = 'running';
      destination = {};
      close = vi.fn();
      createMediaStreamSource() {
        throw 'not-an-error';
      }
      createGain = vi.fn();
      createAnalyser = vi.fn();
    }
    vi.stubGlobal('AudioContext', FailingCtx);
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(
        mock.jsMeet.events.conference.TRACK_ADDED,
        makeRemoteAudioTrack('string-error'),
      );
      const el = document.querySelector(
        'audio[data-loungemesh-participant="string-error"]',
      ) as HTMLAudioElement | null;
      expect(el?.volume).toBe(1);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not rewire from a stream watch while playback is locked or muted', async () => {
    vi.useFakeTimers();
    const createSpy = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
    class RunningCtx {
      state = 'running';
      destination = {};
      close = vi.fn();
      createMediaStreamSource = createSpy;
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    let muted = false;
    const el = document.createElement('audio');
    const track = {
      getType: () => 'audio',
      getParticipantId: () => 'watch-user',
      isLocal: () => false,
      isMuted: () => muted,
      attach: vi.fn(),
      detach: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      const internal = adapter as unknown as {
        playbackUnlocked: boolean;
        ensureRemoteAudioStreamWatch: (t: unknown, sink: HTMLAudioElement) => void;
      };
      internal.playbackUnlocked = false;
      internal.ensureRemoteAudioStreamWatch(track, el);
      const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
      el.srcObject = { getAudioTracks: () => [audio] } as unknown as MediaStream;
      vi.advanceTimersByTime(100);
      expect(createSpy).not.toHaveBeenCalled();

      muted = true;
      internal.playbackUnlocked = true;
      internal.ensureRemoteAudioStreamWatch(track, el);
      vi.advanceTimersByTime(100);
      expect(createSpy).not.toHaveBeenCalled();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('no-ops stream watch setup when the track has no participant id', async () => {
    const internal = adapter as unknown as {
      ensureRemoteAudioStreamWatch: (t: unknown, sink: HTMLAudioElement) => void;
      pendingRemoteAudio: Map<string, unknown>;
    };
    internal.ensureRemoteAudioStreamWatch(
      { getType: () => 'audio', isMuted: () => false },
      document.createElement('audio'),
    );
    expect(internal.pendingRemoteAudio.size).toBe(0);
  });

  it('treats remote tracks without isMuted as active for speaking detection', async () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    class RunningCtx {
      state = 'running';
      destination = { maxChannelCount: 2 };
      currentTime = 0;
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: (buf: Uint8Array) => buf.fill(80),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    const onSpeaking = vi.fn();
    adapter.on('participantSpeakingChanged', onSpeaking);
    const track = makeRemoteAudioTrack('no-is-muted-fn');
    delete (track as { isMuted?: () => boolean }).isMuted;
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, track);
      rafCb?.(0);
      expect(onSpeaking).toHaveBeenCalledWith('no-is-muted-fn', true);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stops speaking detection when the remote track becomes inactive', async () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    let muted = false;
    class RunningCtx {
      state = 'running';
      destination = { maxChannelCount: 2 };
      currentTime = 0;
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: (buf: Uint8Array) => buf.fill(80),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    const onSpeaking = vi.fn();
    adapter.on('participantSpeakingChanged', onSpeaking);
    const track = {
      ...makeRemoteAudioTrack('inactive-speak'),
      isMuted: () => muted,
    };
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, track);
      rafCb?.(0);
      expect(onSpeaking).toHaveBeenCalledWith('inactive-speak', true);
      onSpeaking.mockClear();
      muted = true;
      rafCb?.(0);
      expect(onSpeaking).toHaveBeenCalledWith('inactive-speak', false);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('wires remote audio when participant id is only on ownerId', async () => {
    const createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
    class RunningCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      close = vi.fn();
      createMediaStreamSource = createMediaStreamSource;
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const stream = {
      getAudioTracks: () => [audio],
      getTracks: () => [audio],
    } as unknown as MediaStream;
    const track = {
      getType: () => 'audio',
      getParticipantId: () => undefined,
      ownerId: 'owner-only',
      isLocal: () => false,
      isMuted: () => false,
      attach: vi.fn((el: HTMLAudioElement) => {
        el.srcObject = stream;
      }),
      detach: vi.fn(),
    };
    try {
      await adapter.connect();
      mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
      await adapter.joinRoom('room', 'A', {});
      adapter.resumePlayback();
      mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, track);
      expect(createMediaStreamSource).toHaveBeenCalledTimes(1);
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('refreshRemoteAudio re-wires participant audio and reports speaking', async () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    class SpeakingCtx {
      state = 'running';
      currentTime = 0;
      destination = { maxChannelCount: 2 };
      onstatechange: (() => void) | null = null;
      resume = vi.fn();
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        smoothingTimeConstant: 0.65,
        frequencyBinCount: 256,
        getByteFrequencyData: (buf: Uint8Array) => buf.fill(80),
      }));
    }
    vi.stubGlobal('AudioContext', SpeakingCtx);

    const remoteTrack = makeRemoteAudioTrack('remote-speak');
    mock.conference._remoteTracks.push(remoteTrack);
    const onSpeaking = vi.fn();
    adapter.on('participantSpeakingChanged', onSpeaking);

    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    adapter.resumePlayback();
    adapter.refreshRemoteAudio();
    rafCb?.(0);
    expect(onSpeaking).toHaveBeenCalledWith('remote-speak', true);
    adapter.disconnect();
    vi.unstubAllGlobals();
  });

  it('refreshRemoteAudio skips local, muted, and non-audio participant tracks', async () => {
    const createSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
    class RunningCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      close = vi.fn();
      createMediaStreamSource = createSource;
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);

    mock.conference._remoteTracks.length = 0;
    mock.conference.getParticipants.mockReturnValue([
      {},
      {
        getTracks: () => [
          { isLocal: () => true, getType: () => 'audio', isMuted: () => false },
          { isLocal: () => false, getType: () => 'video', isMuted: () => false },
          { isLocal: () => false, getType: () => 'audio', isMuted: () => true },
          {
            getType: () => 'audio',
            getParticipantId: () => 'wired',
            isLocal: () => false,
            isMuted: () => false,
            getOriginalStream: () => makeRemoteAudioTrack('wired').getOriginalStream?.()!,
          },
        ],
      },
    ]);

    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    adapter.resumePlayback();
    createSource.mockClear();
    adapter.refreshRemoteAudio();
    expect(createSource).toHaveBeenCalledTimes(1);
    adapter.disconnect();
    vi.unstubAllGlobals();
  });

  it('treats missing isMuted as unmuted when monitoring remote audio', async () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    class RunningCtx {
      state = 'running';
      currentTime = 0;
      destination = { maxChannelCount: 2 };
      resume = vi.fn();
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      createAnalyser = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 512,
        smoothingTimeConstant: 0.65,
        frequencyBinCount: 256,
        getByteFrequencyData: (buf: Uint8Array) => buf.fill(80),
      }));
    }
    vi.stubGlobal('AudioContext', RunningCtx);

    const onSpeaking = vi.fn();
    adapter.on('participantSpeakingChanged', onSpeaking);
    await adapter.connect();
    mock.connection._fire(mock.jsMeet.events.connection.CONNECTION_ESTABLISHED);
    await adapter.joinRoom('room', 'A', {});
    adapter.resumePlayback();
    mock.conference._fire(
      mock.jsMeet.events.conference.TRACK_ADDED,
      makeRemoteAudioTrack('no-muted-fn'),
    );
    rafCb?.(0);
    expect(onSpeaking).toHaveBeenCalledWith('no-muted-fn', true);
    adapter.disconnect();
    vi.unstubAllGlobals();
  });

  it('recreates a stored stub AudioContext on refresh', async () => {
    const {
      resetPreGestureAudioContextShimForTests,
      isLoungeMeshStubAudioContext,
      installPreGestureAudioContextShim,
      unlockAudioContextConstructor,
    } = await import('@/utils/jitsiConsole');
    resetPreGestureAudioContextShimForTests();
    installPreGestureAudioContextShim();
    const stubCtx = new AudioContext();
    expect(isLoungeMeshStubAudioContext(stubCtx)).toBe(true);
    (adapter as unknown as { audioContext?: AudioContext; playbackUnlocked?: boolean }).audioContext =
      stubCtx;
    (adapter as unknown as { playbackUnlocked: boolean }).playbackUnlocked = true;
    unlockAudioContextConstructor();
    adapter.refreshRemoteAudio();
    const nextCtx = (adapter as unknown as { audioContext?: AudioContext }).audioContext;
    expect(nextCtx).not.toBe(stubCtx);
    expect(isLoungeMeshStubAudioContext(nextCtx)).toBe(false);
    resetPreGestureAudioContextShimForTests();
  });
});
