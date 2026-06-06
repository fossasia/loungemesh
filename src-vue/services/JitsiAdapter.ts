import { getConnectionOptions } from '@/config/connectionOptions';
import { jitsiInitOptions } from '@/config/jitsiOptions';
import { conferenceErrorDetail } from '@/services/conferenceErrorDetail';
import { secureConferenceName } from '@/utils/secureConferenceName';
import type { JitsiConference, JitsiMeetJS, JitsiTrack, ReceiverConstraints } from '@/types/jitsi';
import type {
  ConnectionOptions,
  MediaService,
  MediaServiceEvent,
  MediaServiceEventMap,
} from './MediaService';
import { participantIdFromTrack, sanitizeParticipantProperties } from '@/utils/jitsiParticipant';
import { decodeXmppCommandValue, encodeXmppCommandValue } from '@/utils/xmppCommandWire';
import { mediaDebug, mediaDebugTrack, isMediaDebugEnabled } from '@/utils/mediaDebug';
import {
  installBenignJitsiConsoleFilter,
  isLoungeMeshStubAudioContext,
  unlockAudioContextConstructor,
  withStubAudioContextDuringInit,
} from '@/utils/jitsiConsole';
import { startSpeakingLevelMonitor } from '@/utils/speakingLevel';
import {
  attachTrackToAudioElement,
  resolveRemoteAudioPlaybackStream,
  whenJitsiAudioPlaybackReady,
} from '@/utils/jitsiTrackPlaybackStream';

type Listener = (...args: unknown[]) => void;

function getJitsiMeetJS(): JitsiMeetJS {
  const js = window.JitsiMeetJS;
  if (!js) {
    throw new Error('window.JitsiMeetJS not found. Load lib-jitsi-meet before app start.');
  }
  return js;
}

function ensureDisconnectReturnsPromise(connection: import('@/types/jitsi').JitsiConnection): void {
  const mutable = connection as import('@/types/jitsi').JitsiConnection & {
    __loungemeshDisconnectWrapped?: boolean;
  };
  if (mutable.__loungemeshDisconnectWrapped) return;
  const disconnect = mutable.disconnect.bind(mutable);
  mutable.disconnect = (event?: unknown) => Promise.resolve(disconnect(event));
  mutable.__loungemeshDisconnectWrapped = true;
}

function shouldDisableTurnCredentialDiscovery(): boolean {
  return import.meta.env.VITE_DISABLE_STUN_TURN_DISCOVERY !== 'false';
}

function disableTurnCredentialDiscovery(connection: import('@/types/jitsi').JitsiConnection): void {
  if (!shouldDisableTurnCredentialDiscovery()) return;
  const candidates = [
    connection.jingle,
    connection.xmpp?.connection?.jingle,
  ];
  for (const jingle of candidates) {
    if (jingle?.getStunAndTurnCredentials) {
      jingle.getStunAndTurnCredentials = () => {};
    }
  }
}

function withoutThirdPartyUnloadListener<T>(fn: () => T): T {
  const original = window.addEventListener;
  window.addEventListener = function addEventListenerWithoutUnload(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type === 'unload') return;
    return original.call(window, type, listener, options);
  } as typeof window.addEventListener;
  try {
    return fn();
  } finally {
    window.addEventListener = original;
  }
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
  private pendingRemoteAudio = new Map<string, JitsiTrack>();
  private remoteAudioStreamWatches = new Map<string, () => void>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();
  private wiredRemoteTracks = new Map<string, JitsiTrack>();
  private elementVolumeFallback = new Set<string>();
  private speakingMonitors = new Map<string, () => void>();
  private playbackUnlocked = false;

  init(): void {
    if (this.jsMeet) return;
    installBenignJitsiConsoleFilter();
    const jsMeet = getJitsiMeetJS();
    jsMeet.setLogLevel(isMediaDebugEnabled() ? jsMeet.logLevels.ERROR : jsMeet.logLevels.OFF);
    withStubAudioContextDuringInit(() => {
      jsMeet.init(jitsiInitOptions);
    });
    this.jsMeet = jsMeet;
  }

  async connect(opts?: ConnectionOptions): Promise<void> {
    this.init();
    const jsMeet = this.jsMeet!;
    if (this.connection) {
      if (!this.connected) {
        try {
          this.connection.disconnect();
        } catch {
          /* stale lib-jitsi connection */
        }
        this.connection = undefined;
      } else {
        return;
      }
    }

    const baseOpts = { ...getConnectionOptions(), ...opts } as Record<string, unknown>;
    this.jwt = opts?.jwt;
    this.appId = opts?.appId ?? null;

    const connection = withoutThirdPartyUnloadListener(
      () => new jsMeet.JitsiConnection(this.appId, this.jwt ?? null, baseOpts),
    );
    ensureDisconnectReturnsPromise(connection);
    disableTurnCredentialDiscovery(connection);

    connection.addEventListener(jsMeet.events.connection.CONNECTION_ESTABLISHED, () => {
      this.connected = true;
      this.emit('connected');
    });
    connection.addEventListener(jsMeet.events.connection.CONNECTION_FAILED, () => {
      this.connected = false;
      const detail = connection.xmpp?.lastErrorMsg;
      this.leaveRoom();
      this.emit(
        'connectionFailed',
        detail && String(detail).trim().length ? String(detail) : 'connection_failed',
      );
      this.connection = undefined;
    });
    connection.addEventListener(jsMeet.events.connection.CONNECTION_DISCONNECTED, () => {
      this.connected = false;
      this.leaveRoom();
      this.connection = undefined;
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

    const name = secureConferenceName(room, import.meta.env.VITE_SESSION_PREFIX, 'lms');
    const conference = connection.initJitsiConference(
      name,
      conferenceOptions ? { ...conferenceOptions } : {},
    );
    const ev = jsMeet.events.conference;

    conference.on(ev.USER_JOINED, (id: unknown, user: unknown) => {
      this.emit('userJoined', String(id), user);
      this.emitParticipantTracks(user);
    });
    conference.on(ev.USER_LEFT, (id: unknown) => {
      this.removeParticipantAudio(String(id));
      this.emit('userLeft', String(id));
    });
    conference.on(ev.CONFERENCE_JOINED, () => {
      this.joined = true;
      conference.setDisplayName(displayName);
      this.emit('conferenceJoined');
      this.emitExistingConferenceTracks(conference);
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
      mediaDebugTrack('JitsiAdapter', 'TRACK_ADDED', t);
      if (t.isLocal?.()) return;
      if (t.getType?.() === 'audio' && !t.isMuted?.()) this.wireRemoteAudioTrack(t);
      this.emit('trackAdded', t);
    });
    conference.on(ev.TRACK_MUTE_CHANGED, (track: unknown) => {
      const t = track as JitsiTrack;
      mediaDebugTrack('JitsiAdapter', 'TRACK_MUTE_CHANGED', t);
      if (t.isLocal?.()) return;
      if (t.getType?.() === 'audio') {
        const participantId = participantIdFromTrack(t);
        if (t.isMuted?.()) {
          if (participantId) this.removeParticipantAudio(participantId);
        } else {
          this.wireRemoteAudioTrack(t);
        }
      }
      this.emit('trackMuteChanged', t);
    });
    conference.on(ev.TRACK_REMOVED, (track: unknown) => {
      const t = track as JitsiTrack;
      mediaDebugTrack('JitsiAdapter', 'TRACK_REMOVED', t);
      if (t.isLocal?.()) return;
      if (t.getType?.() === 'audio') {
        const participantId = participantIdFromTrack(t);
        if (participantId) this.removeParticipantAudio(participantId);
      }
      this.emit('trackRemoved', t);
    });
    conference.on(ev.PARTICIPANT_PROPERTY_CHANGED, (e: unknown) => {
      const participant = e as { _id?: string; _properties?: Record<string, unknown> };
      const id = participant?._id;
      const props = participant?._properties;
      if (id && props) {
        this.emit('participantPropertyChanged', id, sanitizeParticipantProperties(props));
      }
    });
    conference.on(ev.DISPLAY_NAME_CHANGED, (id: unknown, displayName: unknown) => {
      const name = String(displayName ?? '').trim();
      if (name) this.emit('displayNameChanged', String(id), name);
    });

    const sessionCommands = [
      'pos',
      'name',
      'host',
      'lobby',
      'react',
      'hand',
      'poll',
      'notes',
      'room',
      'mod',
      'wb',
      'access',
      'chat',
    ] as const;
    for (const cmd of sessionCommands) {
      conference.addCommandListener(cmd, (payload: { value: string }) => {
        this.emit('command', cmd, { value: decodeXmppCommandValue(payload.value) });
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
    const clamped = Math.max(0, Math.min(1, gain));
    if (this.elementVolumeFallback.has(userId)) {
      const el = this.remoteAudioElements.get(userId);
      if (el) el.volume = clamped;
      return;
    }
    const node = this.gainNodes.get(userId);
    if (!node || !this.audioContext) return;
    if (clamped === 0) {
      node.gain.value = 0;
      return;
    }
    node.gain.setTargetAtTime(clamped, this.audioContext.currentTime, 0.015);
  }

  disconnectParticipantAudio(userId: string): void {
    this.removeParticipantAudio(userId);
  }

  resumePlayback(): void {
    this.playbackUnlocked = true;
    this.refreshRemoteAudio();
  }

  refreshRemoteAudio(): void {
    if (!this.playbackUnlocked) return;
    unlockAudioContextConstructor();
    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    const pending = [...this.pendingRemoteAudio.values()];
    this.pendingRemoteAudio.clear();
    pending.forEach((track) => this.wireRemoteAudioTrack(track));

    const conference = this.conference;
    const getParticipants = (
      conference as { getParticipants?: () => unknown[] } | undefined
    )?.getParticipants;
    if (!getParticipants || !conference) return;
    for (const participant of getParticipants.call(conference)) {
      const tracks =
        (participant as { getTracks?: () => JitsiTrack[] }).getTracks?.() ?? [];
      for (const track of tracks) {
        const t = track as JitsiTrack;
        if (t.isLocal?.()) continue;
        if (t.getType?.() === 'audio' && !t.isMuted?.()) this.wireRemoteAudioTrack(t);
      }
    }
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
    this.conference?.sendCommand(name, { value: encodeXmppCommandValue(value) });
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

  private emitParticipantTracks(participant: unknown): void {
    const tracks =
      (participant as { getTracks?: () => JitsiTrack[] }).getTracks?.() ?? [];
    for (const track of tracks) {
      const t = track as JitsiTrack;
      if (t.isLocal?.()) continue;
      if (t.getType?.() === 'audio' && !t.isMuted?.()) this.wireRemoteAudioTrack(t);
      this.emit('trackAdded', t);
    }
  }

  private emitExistingConferenceTracks(conference: JitsiConference): void {
    const getParticipants = (
      conference as { getParticipants?: () => unknown[] }
    ).getParticipants;
    if (!getParticipants) return;
    for (const participant of getParticipants.call(conference)) {
      this.emitParticipantTracks(participant);
    }
  }

  private ensureAudioContext(): AudioContext {
    unlockAudioContextConstructor();
    if (
      this.audioContext &&
      (this.audioContext.state === 'closed' || isLoungeMeshStubAudioContext(this.audioContext))
    ) {
      try {
        void this.audioContext.close();
      } catch {
        /* already closed */
      }
      this.audioContext = undefined;
    }
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private getRemoteAudioElement(participantId: string): HTMLAudioElement {
    let el = this.remoteAudioElements.get(participantId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      el.dataset.loungemeshParticipant = participantId;
      el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      this.remoteAudioElements.set(participantId, el);
    }
    return el;
  }

  private wireRemoteAudioElementOnly(participantId: string, track: JitsiTrack, volume: number): void {
    const el = this.getRemoteAudioElement(participantId);
    attachTrackToAudioElement(track, el);
    el.volume = Math.max(0, Math.min(1, volume));
    this.elementVolumeFallback.add(participantId);
    this.wiredRemoteTracks.set(participantId, track);
    mediaDebug('JitsiAdapter', 'wireRemoteAudio:element-fallback', { participantId, volume });
  }

  private wireRemoteAudioTrack(track: JitsiTrack): void {
    if (track.getType() !== 'audio' || track.isMuted?.()) return;
    const id = participantIdFromTrack(track);
    if (!id) {
      mediaDebug('JitsiAdapter', 'wireRemoteAudio:skipped', { reason: 'no-participant-id' });
      return;
    }

    if (!this.playbackUnlocked) {
      this.pendingRemoteAudio.set(id, track);
      return;
    }

    this.clearParticipantAudioGraph(id);

    const sink = this.getRemoteAudioElement(id);
    const stream = resolveRemoteAudioPlaybackStream(track, sink);
    if (!stream) {
      this.ensureRemoteAudioStreamWatch(track, sink);
      return;
    }
    this.pendingRemoteAudio.delete(id);
    this.elementVolumeFallback.delete(id);

    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    try {
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      gain.gain.value = 1;
      source.connect(gain);
      source.connect(analyser);
      gain.connect(ctx.destination);

      this.mediaSources.set(id, source);
      this.gainNodes.set(id, gain);
      this.wiredRemoteTracks.set(id, track);
      this.speakingMonitors.get(id)?.();
      this.speakingMonitors.set(
        id,
        startSpeakingLevelMonitor({
          analyser,
          isInactive: () => track.isMuted?.() ?? false,
          onChange: (speaking) => this.emit('participantSpeakingChanged', id, speaking),
        }),
      );

      if (ctx.state === 'suspended') {
        ctx.onstatechange = () => {
          if (ctx.state !== 'running') return;
          ctx.onstatechange = null;
          if (this.gainNodes.get(id) === gain) {
            gain.connect(ctx.destination);
          }
        };
      }
      mediaDebug('JitsiAdapter', 'wireRemoteAudio:web-audio', { participantId: id });
    } catch (err) {
      mediaDebug('JitsiAdapter', 'wireRemoteAudio:web-audio-failed', {
        participantId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      this.wireRemoteAudioElementOnly(id, track, 1);
    }
  }

  private cancelRemoteAudioStreamWatch(userId: string): void {
    this.remoteAudioStreamWatches.get(userId)?.();
    this.remoteAudioStreamWatches.delete(userId);
  }

  private ensureRemoteAudioStreamWatch(track: JitsiTrack, sink: HTMLAudioElement): void {
    const id = participantIdFromTrack(track);
    if (!id) return;
    this.pendingRemoteAudio.set(id, track);
    this.cancelRemoteAudioStreamWatch(id);
    const stop = whenJitsiAudioPlaybackReady(
      track,
      () => {
        if (!this.playbackUnlocked || track.isMuted?.()) return;
        this.wireRemoteAudioTrack(track);
      },
      sink,
    );
    this.remoteAudioStreamWatches.set(id, stop);
  }

  /** Tear down Web Audio nodes and watches without detaching the Jitsi track from its sink. */
  private clearParticipantAudioGraph(userId: string): void {
    this.cancelRemoteAudioStreamWatch(userId);
    this.speakingMonitors.get(userId)?.();
    this.speakingMonitors.delete(userId);
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
    this.pendingRemoteAudio.delete(userId);
    this.elementVolumeFallback.delete(userId);
  }

  private removeParticipantAudio(userId: string): void {
    this.clearParticipantAudioGraph(userId);

    const wired = this.wiredRemoteTracks.get(userId);
    const el = this.remoteAudioElements.get(userId);
    if (wired && el) {
      try {
        (wired as { detach?: (element: HTMLElement) => void }).detach?.(el);
      } catch {
        /* already detached */
      }
    }
    this.wiredRemoteTracks.delete(userId);

    if (el) {
      el.srcObject = null;
      el.remove();
      this.remoteAudioElements.delete(userId);
    }
  }

  private disposeAudioGraph(): void {
    for (const stop of this.speakingMonitors.values()) stop();
    this.speakingMonitors.clear();
    for (const id of [...this.gainNodes.keys()]) {
      this.removeParticipantAudio(id);
    }
    this.pendingRemoteAudio.clear();
    for (const stop of this.remoteAudioStreamWatches.values()) stop();
    this.remoteAudioStreamWatches.clear();
    this.elementVolumeFallback.clear();
    for (const id of [...this.remoteAudioElements.keys()]) {
      this.removeParticipantAudio(id);
    }
    void this.audioContext?.close();
    this.audioContext = undefined;
    this.playbackUnlocked = false;
  }
}
