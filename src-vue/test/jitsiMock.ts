import { vi } from 'vitest';
import type { JitsiConference, JitsiConnection, JitsiMeetJS, JitsiTrack } from '@/types/jitsi';

type Handler = (...args: unknown[]) => void;

export type JitsiMockHandles = {
  connection: JitsiConnection & {
    _handlers: Map<string, Handler>;
    _fire: (event: string, ...args: unknown[]) => void;
  };
  conference: JitsiConference & {
    _handlers: Map<string, Handler>;
    _fire: (event: string, ...args: unknown[]) => void;
  };
  jsMeet: JitsiMeetJS;
  cleanup: () => void;
};

export function installJitsiMock(): JitsiMockHandles {
  const conferenceHandlers = new Map<string, Handler>();
  const connectionHandlers = new Map<string, Handler>();

  const remoteTracks: JitsiTrack[] = [];

  const conference = {
    _handlers: conferenceHandlers,
    _remoteTracks: remoteTracks,
    _fire(event: string, ...args: unknown[]) {
      conferenceHandlers.get(event)?.(...args);
    },
    join: vi.fn(),
    leave: vi.fn(),
    myUserId: vi.fn(() => 'local-1'),
    getParticipants: vi.fn(() => [
      {
        getId: () => 'remote-1',
        getDisplayName: () => 'Remote',
        getTracks: () => remoteTracks,
      },
    ]),
    setDisplayName: vi.fn(),
    sendTextMessage: vi.fn(),
    sendCommand: vi.fn(),
    addCommandListener: vi.fn((name: string, handler: Handler) => {
      conferenceHandlers.set(`cmd:${name}`, handler);
    }),
    addTrack: vi.fn().mockResolvedValue(undefined),
    replaceTrack: vi.fn().mockResolvedValue(undefined),
    setLocalParticipantProperty: vi.fn(),
    setReceiverConstraints: vi.fn(),
    getLocalVideoTrack: vi.fn(() => ({ videoType: 'camera', dispose: vi.fn() })),
    on(event: string, handler: Handler) {
      conferenceHandlers.set(event, handler);
    },
  } as unknown as JitsiMockHandles['conference'];

  const connection = {
    _handlers: connectionHandlers,
    _fire(event: string, ...args: unknown[]) {
      connectionHandlers.get(event)?.(...args);
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    initJitsiConference: vi.fn(() => conference),
    addEventListener: vi.fn((event: string, handler: Handler) => {
      connectionHandlers.set(event, handler);
    }),
    jingle: { getStunAndTurnCredentials: vi.fn() },
    xmpp: {
      lastErrorMsg: 'xmpp-error',
      connection: { jingle: { getStunAndTurnCredentials: vi.fn() } },
    },
  } as unknown as JitsiMockHandles['connection'];

  const events = {
    connection: {
      CONNECTION_ESTABLISHED: 'connection.connectionEstablished',
      CONNECTION_FAILED: 'connection.connectionFailed',
      CONNECTION_DISCONNECTED: 'connection.connectionDisconnected',
    },
    conference: {
      USER_JOINED: 'conference.userJoined',
      USER_LEFT: 'conference.userLeft',
      CONFERENCE_JOINED: 'conference.conferenceJoined',
      CONFERENCE_FAILED: 'conference.conferenceFailed',
      CONFERENCE_ERROR: 'conference.conferenceError',
      TRACK_ADDED: 'conference.trackAdded',
      TRACK_MUTE_CHANGED: 'conference.trackMuteChanged',
      TRACK_REMOVED: 'conference.trackRemoved',
      MESSAGE_RECEIVED: 'conference.messageReceived',
      PARTICIPANT_PROPERTY_CHANGED: 'conference.participantPropertyChanged',
      DISPLAY_NAME_CHANGED: 'conference.displayNameChanged',
    },
  };

  const jsMeet = {
    setLogLevel: vi.fn(),
    init: vi.fn(),
    logLevels: { ERROR: 'error', OFF: 'off' },
    events,
    JitsiConnection: vi.fn(function JitsiConnection() {
      return connection;
    }),
    createLocalTracks: vi.fn((opts?: { devices?: string[] }) => {
      const devices = opts?.devices ?? ['audio'];
      return Promise.resolve(
        devices.map((device) => ({
          getType: () => (device === 'audio' ? 'audio' : 'video'),
          videoType: device === 'desktop' ? 'desktop' : 'camera',
          isLocal: () => true,
          isMuted: () => false,
          mute: vi.fn(),
          unmute: vi.fn(),
          attach: vi.fn(),
          detach: vi.fn(),
          dispose: vi.fn(),
        })) as JitsiTrack[],
      );
    }),
  } as unknown as JitsiMeetJS;

  window.JitsiMeetJS = jsMeet;

  return {
    connection,
    conference,
    jsMeet,
    cleanup: () => {
      delete window.JitsiMeetJS;
    },
  };
}

export function makeRemoteAudioTrack(id: string): JitsiTrack {
  const audioTrack = { kind: 'audio', readyState: 'live', stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    id: 'stream-1',
    getAudioTracks: () => [audioTrack],
    getTracks: () => [audioTrack],
  } as unknown as MediaStream;
  return {
    getType: () => 'audio',
    getParticipantId: () => id,
    isLocal: () => false,
    isMuted: () => false,
    mute: vi.fn(),
    unmute: vi.fn(),
    attach: vi.fn((el: HTMLAudioElement) => {
      el.srcObject = stream;
    }),
    detach: vi.fn(),
    getOriginalStream: () => stream,
  } as unknown as JitsiTrack;
}
