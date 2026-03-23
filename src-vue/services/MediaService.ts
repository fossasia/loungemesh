import type { JitsiTrack, ReceiverConstraints } from '@/types/jitsi';

export type MediaTrackHandle = JitsiTrack;

export type ConnectionOptions = {
  hosts?: Record<string, string>;
  serviceUrl?: string;
  websocket?: string;
  bosh?: string;
  clientNode?: string;
  externalConnectUrl?: string;
  /** JWT for secure-domain Jitsi */
  jwt?: string;
  appId?: string | null;
};

export type MediaServiceEvent =
  | 'connected'
  | 'disconnected'
  | 'connectionFailed'
  | 'conferenceJoined'
  | 'conferenceError'
  | 'userJoined'
  | 'userLeft'
  | 'trackAdded'
  | 'messageReceived'
  | 'participantPropertyChanged'
  | 'command';

export type MediaServiceEventMap = {
  connected: [];
  disconnected: [];
  connectionFailed: [detail: string];
  conferenceJoined: [];
  conferenceError: [detail: string];
  userJoined: [id: string, user: unknown];
  userLeft: [id: string];
  trackAdded: [track: JitsiTrack];
  messageReceived: [id: string, text: string, nr: number];
  participantPropertyChanged: [id: string, properties: Record<string, unknown>];
  command: [name: string, payload: { value: string }];
};

export interface MediaService {
  init(): void;
  connect(opts?: ConnectionOptions): Promise<void>;
  disconnect(): void;
  joinRoom(room: string, displayName: string, conferenceOptions: Record<string, unknown>): Promise<void>;
  leaveRoom(): void;
  createLocalTracks(devices: ('audio' | 'video' | 'desktop')[]): Promise<MediaTrackHandle[]>;
  addLocalTrack(track: MediaTrackHandle): Promise<void>;
  replaceLocalTrack(oldTrack: MediaTrackHandle, newTrack: MediaTrackHandle): Promise<void>;
  /** 0.0–1.0 gain for spatial audio */
  setParticipantVolume(userId: string, gain: number): void;
  setReceiverConstraints(constraints: ReceiverConstraints): void;
  setDisplayName(name: string): void;
  setLocalParticipantProperty(key: string, value: unknown): void;
  sendTextMessage(text: string): void;
  sendCommand(name: string, value: string): void;
  getLocalUserId(): string | undefined;
  getConference(): import('@/types/jitsi').JitsiConference | undefined;
  isConnected(): boolean;
  isJoined(): boolean;
  on<E extends MediaServiceEvent>(event: E, fn: (...args: MediaServiceEventMap[E]) => void): void;
  off<E extends MediaServiceEvent>(event: E, fn: (...args: MediaServiceEventMap[E]) => void): void;
  /** Secure-domain token refresh */
  onTokenExpired(refreshFn: () => Promise<string | null>): void;
  dispose(): void;
}
