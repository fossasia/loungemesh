/** Typed subset of lib-jitsi-meet used by Flowspace. */

export type TrackType = 'audio' | 'video';

export interface JitsiTrack {
  getType(): TrackType;
  getParticipantId(): string;
  isLocal(): boolean;
  isMuted(): boolean;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  videoType?: 'camera' | 'desktop';
  attach(element: HTMLElement): void;
  detach(element: HTMLElement): void;
}

export interface ReceiverConstraints {
  colibriClass: string;
  selectedEndpoints: string[];
  lastN: number;
  onStageEndpoints: string[];
  defaultConstraints: { maxHeight: number };
  constraints: Record<string, unknown>;
}

export interface JitsiConference {
  join(): void;
  leave(): void;
  myUserId(): string;
  getLocalVideoTrack?(): JitsiTrack | undefined;
  setDisplayName(name: string): void;
  sendTextMessage(text: string): void;
  sendCommand(name: string, payload: { value: string }): void;
  addCommandListener(name: string, handler: (payload: { value: string }) => void): void;
  addTrack(track: JitsiTrack): Promise<void>;
  replaceTrack(oldTrack: JitsiTrack, newTrack: JitsiTrack): Promise<void>;
  setLocalParticipantProperty(key: string, value: unknown): void;
  setReceiverConstraints(constraints: ReceiverConstraints): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export interface JitsiConnection {
  connect(): void;
  disconnect(): void;
  initJitsiConference(name: string, options: Record<string, unknown>): JitsiConference;
  addEventListener(event: string, handler: () => void): void;
  xmpp?: { lastErrorMsg?: string };
}

export interface JitsiMeetJSEvents {
  connection: {
    CONNECTION_ESTABLISHED: string;
    CONNECTION_FAILED: string;
    CONNECTION_DISCONNECTED: string;
  };
  conference: {
    USER_JOINED: string;
    USER_LEFT: string;
    CONFERENCE_JOINED: string;
    CONFERENCE_ERROR: string;
    TRACK_ADDED: string;
    MESSAGE_RECEIVED: string;
    PARTICIPANT_PROPERTY_CHANGED: string;
  };
}

export interface JitsiMeetJS {
  init(options: Record<string, unknown>): void;
  setLogLevel(level: unknown): void;
  logLevels: { ERROR: unknown };
  events: JitsiMeetJSEvents;
  JitsiConnection: new (
    appId: string | null,
    token: string | null,
    options: Record<string, unknown>,
  ) => JitsiConnection;
  createLocalTracks(options: {
    devices: ('audio' | 'video')[];
    firePermissionPromptIsShownEvent?: boolean;
  }): Promise<JitsiTrack[]>;
}

declare global {
  interface Window {
    JitsiMeetJS?: JitsiMeetJS;
  }
}

/** @deprecated Use JitsiTrack */
export type JitsiTrackLike = JitsiTrack;
/** @deprecated Use JitsiConference */
export type JitsiConferenceLike = JitsiConference;
/** @deprecated Use JitsiConnection */
export type JitsiConnectionLike = JitsiConnection;
/** @deprecated Use JitsiMeetJS */
export type JitsiMeetJSLike = JitsiMeetJS;
