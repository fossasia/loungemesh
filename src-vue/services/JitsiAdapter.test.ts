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
    expect(onFail).toHaveBeenCalledWith(expect.stringContaining('Connection failed'));
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
      selectedEndpoints: [],
      lastN: 0,
      onStageEndpoints: [],
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

  it('resumes suspended AudioContext when wiring remote audio', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    class MockAudioContext {
      state = 'suspended';
      resume = resume;
      destination = {};
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createGain = vi.fn(() => ({ connect: vi.fn(), gain: { value: 1 } }));
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
      expect(resume).toHaveBeenCalled();
      adapter.disconnect();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
