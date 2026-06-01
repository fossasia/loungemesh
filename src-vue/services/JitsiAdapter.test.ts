import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { JitsiAdapter } from './JitsiAdapter';
import { installJitsiMock, makeRemoteAudioTrack } from '@/test/jitsiMock';

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
            getOriginalStream: () => ({}),
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
    mock.conference._fire(mock.jsMeet.events.conference.TRACK_ADDED, {
      getType: () => 'audio',
      getParticipantId: () => 'no-muted-fn',
      isLocal: () => false,
      getOriginalStream: () => ({}),
    });
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
