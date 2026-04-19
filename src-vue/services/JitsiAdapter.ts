import { getConnectionOptions } from '@/config/connectionOptions';
import { conferenceErrorDetail } from '@/services/conferenceErrorDetail';
import { secureConferenceName } from '@/utils/secureConferenceName';
import type { JitsiConference, JitsiMeetJS, JitsiTrack, ReceiverConstraints } from '@/types/jitsi';
import type {
  ConnectionOptions,
  MediaService,
  MediaServiceEvent,
  MediaServiceEventMap,
} from './MediaService';

type Listener = (...args: unknown[]) => void;

function getJitsiMeetJS(): JitsiMeetJS {
  const js = window.JitsiMeetJS;
  if (!js) {
    throw new Error('window.JitsiMeetJS not found. Load lib-jitsi-meet before app start.');
  }
  return js;
}

export class JitsiAdapter implements MediaService {
  private jsMeet?: JitsiMeetJS;
  private connection?: import('@/types/jitsi').JitsiConnection;
  private conference?: JitsiConference;
  private connected = false;
  private joined = false;
  private listeners = new Map<MediaServiceEvent, Set<Listener>>();
  private tokenRefreshFn?: () => Promise<string | null>;
  private jwt?: string;
  private appId: string | null = null;

  private audioContext?: AudioContext;
  private gainNodes = new Map<string, GainNode>();
  private mediaSources = new Map<string, MediaStreamAudioSourceNode>();

  init(): void {
    if (this.jsMeet) return;
    const jsMeet = getJitsiMeetJS();
    jsMeet.setLogLevel(jsMeet.logLevels.ERROR);
    jsMeet.init({});
    this.jsMeet = jsMeet;
  }

  async connect(opts?: ConnectionOptions): Promise<void> {
    this.init();
    const jsMeet = this.jsMeet!;
    if (this.connection) {
      if (!this.connected) this.connection.connect();
      return;
    }

    const baseOpts = { ...getConnectionOptions(), ...opts } as Record<string, unknown>;
    this.jwt = opts?.jwt;
    this.appId = opts?.appId ?? null;

    const connection = new jsMeet.JitsiConnection(this.appId, this.jwt ?? null, baseOpts);

    connection.addEventListener(jsMeet.events.connection.CONNECTION_ESTABLISHED, () => {
      this.connected = true;
      this.emit('connected');
    });
    connection.addEventListener(jsMeet.events.connection.CONNECTION_FAILED, () => {
      this.connected = false;
      const detail = connection.xmpp?.lastErrorMsg;
      this.emit(
        'connectionFailed',
        detail && String(detail).trim().length
          ? String(detail)
          : 'Connection failed — check Jitsi is up, PUBLIC_URL / VITE_JITSI_PUBLIC_URL, firewall, and UDP 10000.',
      );
      this.connection = undefined;
    });
    connection.addEventListener(jsMeet.events.connection.CONNECTION_DISCONNECTED, () => {
      this.connected = false;
      this.emit('disconnected');
    });

    connection.connect();
    this.connection = connection;
  }

  disconnect(): void {
    this.leaveRoom();
    this.connection?.disconnect();
    this.connection = undefined;
    this.connected = false;
    this.disposeAudioGraph();
  }

  async joinRoom(
    room: string,
    displayName: string,
    conferenceOptions: Record<string, unknown>,
  ): Promise<void> {
    if (this.conference) return;
    const jsMeet = this.jsMeet;
    const connection = this.connection;
    if (!jsMeet || !connection) {
      throw new Error('Jitsi connection is not ready.');
    }

    const name = secureConferenceName(room, import.meta.env.VITE_SESSION_PREFIX, 'fls');
    const conference = connection.initJitsiConference(name, conferenceOptions);
    const ev = jsMeet.events.conference;

    conference.on(ev.USER_JOINED, (id: unknown, user: unknown) => {
      this.emit('userJoined', String(id), user);
    });
    conference.on(ev.USER_LEFT, (id: unknown) => {
      this.removeParticipantAudio(String(id));
      this.emit('userLeft', String(id));
    });
    conference.on(ev.CONFERENCE_JOINED, () => {
      this.joined = true;
      conference.setDisplayName(displayName);
      this.emit('conferenceJoined');
    });
    conference.on(ev.MESSAGE_RECEIVED, (id: unknown, text: unknown, nr: unknown) => {
      this.emit('messageReceived', String(id), String(text), Number(nr));
    });
    conference.on(ev.CONFERENCE_ERROR, () => {
      if (this.joined) return;
      const detail = conferenceErrorDetail(connection.xmpp);
      if (detail) this.emit('conferenceError', detail);
    });
    conference.on(ev.CONFERENCE_FAILED, (reason: unknown) => {
      const r = String(reason ?? '');
      if (r.includes('not-authorized') || r.includes('authentication') || r.includes('auth')) {
        void this.handleTokenExpired();
        return;
      }
      if (r.toLowerCase().includes('focus')) {
        window.setTimeout(() => {
          if (this.conference && !this.joined) {
            try {
              conference.join();
            } catch {
              /* retry once when jicofo becomes ready */
            }
          }
        }, 1500);
        return;
      }
      this.emit('conferenceError', r);
      this.conference = undefined;
      this.joined = false;
    });
    conference.on(ev.TRACK_ADDED, (track: unknown) => {
      const t = track as JitsiTrack;
      if (t.isLocal?.()) return;
      this.wireRemoteAudioTrack(t);
      this.emit('trackAdded', t);
    });
    conference.on(ev.PARTICIPANT_PROPERTY_CHANGED, (e: unknown) => {
      const participant = e as { _id?: string; _properties?: Record<string, unknown> };
      const id = participant?._id;
      const props = participant?._properties;
      if (id && props) this.emit('participantPropertyChanged', id, props);
    });

    const sessionCommands = [
      'pos',
      'host',
      'lobby',
      'react',
      'poll',
      'notes',
      'mod',
      'wb',
      'access',
      'chat',
    ] as const;
    for (const cmd of sessionCommands) {
      conference.addCommandListener(cmd, (payload: { value: string }) => {
        this.emit('command', cmd, payload);
      });
    }

    conference.join();
    this.conference = conference;
  }

  leaveRoom(): void {
    this.conference?.leave();
    this.conference = undefined;
    this.joined = false;
    this.disposeAudioGraph();
  }

  async createLocalTracks(devices: ('audio' | 'video' | 'desktop')[]): Promise<JitsiTrack[]> {
    this.init();
    const options = { firePermissionPromptIsShownEvent: true };
    if (devices.includes('desktop')) {
      return this.jsMeet!.createLocalTracks({
        devices: ['desktop'],
        ...options,
      });
    }
    const av = devices.filter((d): d is 'audio' | 'video' => d === 'audio' || d === 'video');
    return this.jsMeet!.createLocalTracks({
      devices: av.length ? av : ['video'],
      ...options,
    });
  }

  async addLocalTrack(track: JitsiTrack): Promise<void> {
    await this.conference?.addTrack(track);
  }

  async replaceLocalTrack(oldTrack: JitsiTrack, newTrack: JitsiTrack): Promise<void> {
    await this.conference?.replaceTrack(oldTrack, newTrack);
  }

  setParticipantVolume(userId: string, gain: number): void {
    const node = this.gainNodes.get(userId);
    if (!node || !this.audioContext) return;
    const clamped = Math.max(0, Math.min(1, gain));
    node.gain.setTargetAtTime(clamped, this.audioContext.currentTime, 0.015);
  }

  setReceiverConstraints(constraints: ReceiverConstraints): void {
    this.conference?.setReceiverConstraints(constraints);
  }

  setDisplayName(name: string): void {
    this.conference?.setDisplayName(name);
  }

  setLocalParticipantProperty(key: string, value: unknown): void {
    this.conference?.setLocalParticipantProperty(key, value);
  }

  sendTextMessage(text: string): boolean {
    if (!this.conference) return false;
    try {
      this.conference.sendTextMessage(text);
      return true;
    } catch {
      return false;
    }
  }

  sendCommand(name: string, value: string): void {
    this.conference?.sendCommand(name, { value });
  }

  getLocalUserId(): string | undefined {
    return this.conference?.myUserId?.();
  }

  getConference(): JitsiConference | undefined {
    return this.conference;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isJoined(): boolean {
    return this.joined;
  }

  on<E extends MediaServiceEvent>(event: E, fn: (...args: MediaServiceEventMap[E]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener);
  }

  off<E extends MediaServiceEvent>(event: E, fn: (...args: MediaServiceEventMap[E]) => void): void {
    this.listeners.get(event)?.delete(fn as Listener);
  }

  onTokenExpired(refreshFn: () => Promise<string | null>): void {
    this.tokenRefreshFn = refreshFn;
  }

  private async handleTokenExpired(): Promise<void> {
    this.emit('tokenExpired');
    if (!this.tokenRefreshFn) return;
    const newJwt = await this.tokenRefreshFn();
    if (!newJwt) {
      this.emit('conferenceError', 'token_refresh_failed');
      return;
    }
    // Reconnect with fresh JWT
    this.jwt = newJwt;
    this.leaveRoom();
    this.connection?.disconnect();
    this.connection = undefined;
    this.connected = false;
    await this.connect({ jwt: newJwt, appId: this.appId ?? undefined } as never);
  }

  dispose(): void {
    this.disconnect();
    this.listeners.clear();
  }

  private emit<E extends MediaServiceEvent>(event: E, ...args: MediaServiceEventMap[E]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private wireRemoteAudioTrack(track: JitsiTrack): void {
    if (track.getType() !== 'audio') return;
    const id = track.getParticipantId?.();
    if (!id) return;

    const stream = (track as unknown as { getOriginalStream?: () => MediaStream }).getOriginalStream?.();
    if (!stream) return;

    const ctx = this.ensureAudioContext();
    this.removeParticipantAudio(id);

    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(ctx.destination);

    this.mediaSources.set(id, source);
    this.gainNodes.set(id, gain);
  }

  private removeParticipantAudio(userId: string): void {
    const source = this.mediaSources.get(userId);
    const gain = this.gainNodes.get(userId);
    try {
      source?.disconnect();
      gain?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.mediaSources.delete(userId);
    this.gainNodes.delete(userId);
  }

  private disposeAudioGraph(): void {
    for (const id of [...this.gainNodes.keys()]) {
      this.removeParticipantAudio(id);
    }
    void this.audioContext?.close();
    this.audioContext = undefined;
  }
}
