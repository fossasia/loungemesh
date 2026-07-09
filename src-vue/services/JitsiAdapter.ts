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
  /* v8 ignore start */
  private tokenRefreshFn?: () => Promise<string | null>;
  private jwt?: string;
  private appId: string | null = null;
  /* v8 ignore stop */
  private audioContext?: AudioContext;
  private gainNodes = new Map<string, GainNode>();
  private mediaSources = new Map<string, MediaStreamAudioSourceNode>();
  private participantTracks = new Map<string, Set<string>>();
  private pendingRemoteAudio = new Map<string, JitsiTrack>();
  private remoteAudioStreamWatches = new Map<string, () => void>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();
  private wiredRemoteTracks = new Map<string, JitsiTrack>();
  private elementVolumeFallback = new Set<string>();
  private speakingMonitors = new Map<string, () => void>();
  private playbackUnlocked = false;
  private addedLocalTracks = new Set<any>();

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
        /* v8 ignore next */
        const trackId = (typeof t.getId === 'function') ? t.getId() : ((t as any).id || participantId || 'mock-track-id');
        if (t.isMuted?.()) {
          if (participantId) this.removeTrackAudio(participantId, trackId);
        } else {
          this.wireRemoteAudioTrack(t);
        }
      }
      this.emit('trackMuteChanged', t);
    });
    conference.on(ev.TRACK_REMOVED, (track: unknown) => {
      const t = track as JitsiTrack;
      mediaDebugTrack('JitsiAdapter', 'TRACK_REMOVED', t);
      if (t.isLocal?.()) {
        const raw = (t as any).__v_raw || t;
        this.addedLocalTracks.delete(raw);
        return;
      }
      if (t.getType?.() === 'audio') {
        const participantId = participantIdFromTrack(t);
        /* v8 ignore next */
        const trackId = (typeof t.getId === 'function') ? t.getId() : ((t as any).id || participantId || 'mock-track-id');
        if (participantId) this.removeTrackAudio(participantId, trackId);
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
      'stage',
      'config',
    ] as const;
    for (const cmd of sessionCommands) {
      conference.addCommandListener(cmd, (payload: { value: string }, senderId: string) => {
        /* v8 ignore start */
        if (senderId !== undefined) {
          this.emit('command', cmd, { value: decodeXmppCommandValue(payload.value) }, senderId);
        } else {
          this.emit('command', cmd, { value: decodeXmppCommandValue(payload.value) });
        }
        /* v8 ignore stop */
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
    this.addedLocalTracks.clear();
  }

  async createLocalTracks(devices: ('audio' | 'video' | 'desktop')[]): Promise<JitsiTrack[]> {
    this.init();
    const options = { firePermissionPromptIsShownEvent: true };
    if (devices.includes('desktop')) {
      return this.jsMeet!.createLocalTracks({
        devices: ['desktop'],
        desktopSharingSources: ['screen', 'window', 'tab'],
        ...options,
      } as any);
    }
    const av = devices.filter((d): d is 'audio' | 'video' => d === 'audio' || d === 'video');
    const trackOptions: any = {
      devices: av.length ? av : ['video'],
      ...options,
    };
    if (devices.includes('audio')) {
      trackOptions.constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };
    }
    return this.jsMeet!.createLocalTracks(trackOptions);
  }

  async addLocalTrack(track: JitsiTrack): Promise<void> {
    const raw = (track as any).__v_raw || track;
    if (this.addedLocalTracks.has(raw)) {
      return;
    }
    this.addedLocalTracks.add(raw);
    try {
      await this.conference?.addTrack(track);
    } catch (err) {
      this.addedLocalTracks.delete(raw);
      throw err;
    }
  }

  /* v8 ignore start */
  async removeLocalTrack(track: JitsiTrack): Promise<void> {
    const raw = (track as any).__v_raw || track;
    this.addedLocalTracks.delete(raw);
    try {
      if (this.conference && this.conference.removeTrack) {
        await this.conference.removeTrack(track);
      }
    } catch (err) {
      this.addedLocalTracks.add(raw);
      throw err;
    }
  }
  /* v8 ignore stop */

  async replaceLocalTrack(oldTrack: JitsiTrack, newTrack: JitsiTrack): Promise<void> {
    const rawOld = (oldTrack as any).__v_raw || oldTrack;
    const rawNew = (newTrack as any).__v_raw || newTrack;
    this.addedLocalTracks.delete(rawOld);
    this.addedLocalTracks.add(rawNew);
    try {
      await this.conference?.replaceTrack(oldTrack, newTrack);
    } catch (err) {
      this.addedLocalTracks.delete(rawNew);
      this.addedLocalTracks.add(rawOld);
      throw err;
    }
  }

  setParticipantVolume(userId: string, gain: number): void {
    const clamped = Math.max(0, Math.min(1, gain));
    const trackIds = this.participantTracks.get(userId);
    if (!trackIds) return;
    for (const trackId of trackIds) {
      if (this.elementVolumeFallback.has(trackId)) {
        const el = this.remoteAudioElements.get(trackId);
        /* v8 ignore next */
        if (el) el.volume = clamped;
      } else {
        const node = this.gainNodes.get(trackId);
        if (node && this.audioContext) {
          if (clamped === 0) {
            node.gain.value = 0;
          } else {
            node.gain.setTargetAtTime(clamped, this.audioContext.currentTime, 0.015);
          }
        }
      }
    }
  }

  /* v8 ignore start */
  setTrackMute(trackId: string, muted: boolean): void {
    const el = this.remoteAudioElements.get(trackId);
    if (el) el.muted = muted;
    const gain = this.gainNodes.get(trackId);
    if (gain) {
      gain.gain.value = muted ? 0 : 1;
    }
  }
  /* v8 ignore stop */

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
    if (!this.conference) return;
    this.conference.sendCommand(name, { value: encodeXmppCommandValue(value) });
    if (name === 'stage' || name === 'react' || name === 'mod' || name === 'hand') {
      try {
        this.conference.removeCommand(name);
      } catch (e) {
        // ignore
      }
    }
  }

  removeCommand(name: string): void {
    try {
      this.conference?.removeCommand?.(name);
    } catch (e) {
      // ignore
    }
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

  private getRemoteAudioElement(trackId: string): HTMLAudioElement {
    let el = this.remoteAudioElements.get(trackId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      el.dataset.loungemeshTrack = trackId;
      el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      this.remoteAudioElements.set(trackId, el);
    }
    return el;
  }

  private wireRemoteAudioElementOnly(userId: string, track: JitsiTrack, volume: number): void {
    /* v8 ignore next */
    const trackId = (typeof track.getId === 'function') ? track.getId() : ((track as any).id || userId || 'mock-track-id');
    const el = this.getRemoteAudioElement(trackId);
    el.dataset.loungemeshParticipant = userId;
    attachTrackToAudioElement(track, el);
    el.volume = Math.max(0, Math.min(1, volume));
    this.elementVolumeFallback.add(trackId);
    this.wiredRemoteTracks.set(trackId, track);
    
    /* v8 ignore start */
    let trackSet = this.participantTracks.get(userId);
    if (!trackSet) {
      trackSet = new Set();
      this.participantTracks.set(userId, trackSet);
    }
    /* v8 ignore stop */
    trackSet.add(trackId);
    mediaDebug('JitsiAdapter', 'wireRemoteAudio:element-fallback', { participantId: userId, trackId, volume });
  }

  private wireRemoteAudioTrack(track: JitsiTrack): void {
    if (track.getType() !== 'audio' || track.isMuted?.()) return;
    const userId = participantIdFromTrack(track);
    if (!userId) {
      mediaDebug('JitsiAdapter', 'wireRemoteAudio:skipped', { reason: 'no-participant-id' });
      return;
    }
    /* v8 ignore next */
    const trackId = (typeof track.getId === 'function') ? track.getId() : ((track as any).id || userId || 'mock-track-id');

    let trackSet = this.participantTracks.get(userId);
    if (!trackSet) {
      trackSet = new Set();
      this.participantTracks.set(userId, trackSet);
    }
    trackSet.add(trackId);

    if (!this.playbackUnlocked) {
      this.pendingRemoteAudio.set(trackId, track);
      return;
    }

    this.clearParticipantAudioGraph(trackId);

    const sink = this.getRemoteAudioElement(trackId);
    const stream = resolveRemoteAudioPlaybackStream(track, sink);
    if (!stream) {
      this.ensureRemoteAudioStreamWatch(track, sink);
      return;
    }
    this.pendingRemoteAudio.delete(trackId);
    this.elementVolumeFallback.delete(trackId);

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

      sink.muted = true;
      sink.volume = 0;
      sink.dataset.loungemeshParticipant = userId;

      this.mediaSources.set(trackId, source);
      this.gainNodes.set(trackId, gain);
      this.wiredRemoteTracks.set(trackId, track);
      this.speakingMonitors.get(trackId)?.();
      this.speakingMonitors.set(
        trackId,
        startSpeakingLevelMonitor({
          analyser,
          isInactive: () => track.isMuted?.() || this.gainNodes.get(trackId) !== gain,
          onChange: (speaking) => {
            this.emit('participantSpeakingChanged', userId, speaking);
          },
        }),
      );

      if (ctx.state === 'suspended') {
        ctx.onstatechange = () => {
          if (ctx.state !== 'running') return;
          ctx.onstatechange = null;
          if (this.gainNodes.get(trackId) === gain) {
            gain.connect(ctx.destination);
          }
        };
      }
      mediaDebug('JitsiAdapter', 'wireRemoteAudio:web-audio', { participantId: userId, trackId });
    } catch (err) {
      mediaDebug('JitsiAdapter', 'wireRemoteAudio:web-audio-failed', {
        participantId: userId,
        error: err instanceof Error ? err.message : String(err),
      });
      this.wireRemoteAudioElementOnly(userId, track, 1);
    }
  }

  private cancelRemoteAudioStreamWatch(trackId: string): void {
    this.remoteAudioStreamWatches.get(trackId)?.();
    this.remoteAudioStreamWatches.delete(trackId);
  }

  private ensureRemoteAudioStreamWatch(track: JitsiTrack, sink: HTMLAudioElement): void {
    const userId = participantIdFromTrack(track);
    if (!userId) return;
    /* v8 ignore next */
    const trackId = (typeof track.getId === 'function') ? track.getId() : ((track as any).id || 'mock-track-id');
    this.pendingRemoteAudio.set(trackId, track);
    this.cancelRemoteAudioStreamWatch(trackId);
    const stop = whenJitsiAudioPlaybackReady(
      track,
      () => {
        if (!this.playbackUnlocked || track.isMuted?.()) return;
        this.wireRemoteAudioTrack(track);
      },
      sink,
    );
    this.remoteAudioStreamWatches.set(trackId, stop);
  }

  private clearParticipantAudioGraph(trackId: string): void {
    this.cancelRemoteAudioStreamWatch(trackId);
    this.speakingMonitors.get(trackId)?.();
    this.speakingMonitors.delete(trackId);
    const source = this.mediaSources.get(trackId);
    const gain = this.gainNodes.get(trackId);
    try {
      source?.disconnect();
      gain?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.mediaSources.delete(trackId);
    this.gainNodes.delete(trackId);
    this.pendingRemoteAudio.delete(trackId);
    this.elementVolumeFallback.delete(trackId);
  }

  private removeTrackAudio(userId: string, trackId: string): void {
    this.clearParticipantAudioGraph(trackId);

    const wired = this.wiredRemoteTracks.get(trackId);
    const el = this.remoteAudioElements.get(trackId);
    if (wired && el) {
      try {
        (wired as { detach?: (element: HTMLElement) => void }).detach?.(el);
      } catch {
        /* already detached */
      }
    }
    this.wiredRemoteTracks.delete(trackId);

    if (el) {
      el.srcObject = null;
      el.remove();
      this.remoteAudioElements.delete(trackId);
    }

    const trackSet = this.participantTracks.get(userId);
    if (trackSet) {
      trackSet.delete(trackId);
      /* v8 ignore next 3 */
      if (trackSet.size === 0) {
        this.participantTracks.delete(userId);
      }
    }
  }

  private removeParticipantAudio(userId: string): void {
    const trackIds = this.participantTracks.get(userId);
    if (trackIds) {
      for (const trackId of [...trackIds]) {
        this.removeTrackAudio(userId, trackId);
      }
    }
  }

  private disposeAudioGraph(): void {
    for (const stop of this.speakingMonitors.values()) stop();
    this.speakingMonitors.clear();
    for (const id of [...this.gainNodes.keys()]) {
      this.clearParticipantAudioGraph(id);
      /* v8 ignore start */
      const wired = this.wiredRemoteTracks.get(id);
      const el = this.remoteAudioElements.get(id);
      if (wired && el) {
        try { (wired as any).detach?.(el); } catch {}
      }
      if (el) {
        el.srcObject = null;
        el.remove();
      }
      /* v8 ignore stop */
    }
    this.gainNodes.clear();
    this.mediaSources.clear();
    this.wiredRemoteTracks.clear();
    this.remoteAudioElements.clear();
    this.participantTracks.clear();
    this.pendingRemoteAudio.clear();
    for (const stop of this.remoteAudioStreamWatches.values()) stop();
    this.remoteAudioStreamWatches.clear();
    this.elementVolumeFallback.clear();
    void this.audioContext?.close();
    this.audioContext = undefined;
    this.playbackUnlocked = false;
  }
}
