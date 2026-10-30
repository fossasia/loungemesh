import { markRaw } from 'vue';
import type { MediaService } from '@/services/MediaService';
import type { JitsiTrack } from '@/types/jitsi';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useAuthStore } from '@/stores/authStore';
import { useReconnectStore } from '@/stores/reconnectStore';
import { buildHelloCommand, handleSessionCommand } from '@/utils/sessionCommands';
import { grantsPayloadForSync } from '@/utils/sessionAccess';
import { participantIdFromTrack, sanitizeParticipantProperties } from '@/utils/jitsiParticipant';
import { spreadInitialUserPosition } from '@/constants/pan';
import { scheduleReceiverRefresh } from '@/utils/scheduleReceiverRefresh';
import { playbackGainForUser } from '@/utils/participantPlaybackGain';
import { mediaDebug, mediaDebugTrack } from '@/utils/mediaDebug';
import { emitMediaStateSnapshot } from '@/utils/mediaStateSnapshot';
import { normalizeSessionError } from '@/services/sessionErrorCodes';
import { unlockMediaPlaybackNow } from '@/utils/resumeMediaPlayback';
import { applyParticipantHandRaised, parseHandRaised } from '@/utils/sessionHandRaise';
import { broadcastHostRoomSettings } from '@/utils/hostRoomSettings';
import { broadcastYjsState, notesDocumentHasContent } from '@/utils/notesYjsSync';
import { isAdmittedParticipant } from '@/utils/lobbyAdmission';
import { broadcastSharedNotes } from '@/utils/notesSync';
import { isOnStage } from '@/components/stage/isOnStage';
import { defaultStageLayout } from '@/stores/sessionFeaturesStore';
import {
  clearStageIfParticipantLeft,
  stopLocalScreenshareIfNeeded,
} from '@/utils/sessionStage';
import { remoteAudioSlot } from '@/utils/remoteAudioSlot';

/** Wire media engine events into Pinia stores (called once per app lifetime). */
export function wireStoreSync(engine: MediaService): void {
  const conferenceStore = useConferenceStore();

  let heartbeatTimer: number | undefined;

  const heldRemoteTracks = new Map<string, JitsiTrack[]>();

  function applyRemoteTrackToStore(id: string, track: JitsiTrack) {
    const features = useSessionFeaturesStore();
    if (!isAdmittedParticipant(features, id)) {
      const held = heldRemoteTracks.get(id) ?? [];
      held.push(track);
      heldRemoteTracks.set(id, held);
      conferenceStore.clearUserTrack(id, 'video');
      conferenceStore.clearUserTrack(id, 'screenshare');
      conferenceStore.clearUserTrack(id, 'screenshareAudio');
      engine.setParticipantPlaybackSuppressed?.(id, true);
      return;
    }
    engine.setParticipantPlaybackSuppressed?.(id, false);
    const kind: 'audio' | 'video' | 'screenshareAudio' =
      track.getType() === 'audio' ? remoteAudioSlot(track) : 'video';

    if (kind === 'video' && track.isMuted()) {
      if (track.videoType === 'desktop') {
        conferenceStore.clearUserTrack(id, 'screenshare');
      } else {
        conferenceStore.clearUserTrack(id, 'video');
      }
    } else {
      conferenceStore.setUserTrack(id, kind, track);
    }
    if (kind === 'audio') {
      if (track.isMuted()) {
        engine.disconnectParticipantAudio?.(id);
      } else {
        const user = conferenceStore.users[id]!;
        const proximity = user.volume ?? 1;
        engine.setParticipantVolume(id, playbackGainForUser(user, proximity));
      }
    }
    if (kind === 'video') emitMediaStateSnapshot('trackAdded');
    scheduleReceiverRefresh();
  }

  useSessionFeaturesStore().$subscribe(() => {
    const features = useSessionFeaturesStore();
    for (const id of [...heldRemoteTracks.keys()]) {
      if (!isAdmittedParticipant(features, id)) continue;
      const tracks = heldRemoteTracks.get(id)!;
      heldRemoteTracks.delete(id);
      engine.setParticipantPlaybackSuppressed?.(id, false);
      for (const track of tracks) applyRemoteTrackToStore(id, track);
    }
  });

  engine.on('connected', () => {
    useConnectionStore().$patch({ connected: true, error: undefined });
    useReconnectStore().onConnectionRecovered();
  });
  engine.on('disconnected', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
    useConnectionStore().$patch({ connected: false });
    useReconnectStore().onConnectionLost('disconnected');
  });
  engine.on('connectionFailed', (detail) => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
    mediaDebug('wiring', 'connectionFailed', { detail });
    useConnectionStore().$patch({
      connected: false,
      error: normalizeSessionError(detail, 'connection'),
      connection: undefined,
    });
    useReconnectStore().onConnectionLost('connection_failed');
  });
  engine.on('bridgeChannelOpen', () => {
    scheduleReceiverRefresh();
    engine.refreshRemoteAudio?.();
  });
  engine.on('conferenceJoined', () => {
    unlockMediaPlaybackNow(engine);
    mediaDebug('wiring', 'conferenceJoined', { localUserId: engine.getLocalUserId() });
    conferenceStore.isJoined = true;
    conferenceStore.isJoining = false;
    conferenceStore.error = undefined;
    const conf = engine.getConference();
    if (conf) {
      conferenceStore.conferenceObject = markRaw(conf as object) as typeof conferenceStore.conferenceObject;
    }
    const id = engine.getLocalUserId();
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    if (id) {
      local.setMyID(id);
      const auth = useAuthStore();
      /* v8 ignore start */
      if (auth.isAuthenticated && auth.user?.avatarUrl) {
        engine.setLocalParticipantProperty('avatarUrl', auth.user.avatarUrl);
      }
      /* v8 ignore stop */
      if (!features.isFetchingConfig) {
        features.syncOrClaimHostOnLoaded(engine);
      }
      // Room config often returns before the conference join finishes, so the
      // fetch callback skips Yjs. Bind it once we are actually in the room.
      features.setupYjsSync(engine);
      const others = Object.values(conferenceStore.users).map((u) => u.pos);
      local.setLocalPosition(spreadInitialUserPosition(others));
      local.publishLocalPosition();
      scheduleReceiverRefresh();
      emitMediaStateSnapshot('conferenceJoined');

      engine.sendCommand('hello', buildHelloCommand(id));
      features.resendSessionIdentity(engine);
      engine.sendCommand('hello_req', JSON.stringify({ from: id }));

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = window.setInterval(() => {
        if (!engine.isJoined()) return;
        const myId = local.id || engine.getLocalUserId();
        if (myId) {
          engine.sendCommand('hello', buildHelloCommand(myId));
        }
        const conf = engine.getConference();
        const liveIds = conf ? conf.getParticipants().map((p) => p.getId()) : [];
        conferenceStore.pruneStaleUsers(45000, liveIds);
        scheduleReceiverRefresh();
        engine.refreshRemoteAudio?.();
        features.resendSessionIdentity(engine);
      }, 5000);
    }
  });
  engine.on('conferenceError', (detail) => {
    mediaDebug('wiring', 'conferenceError', { detail, joined: engine.isJoined() });
    if (!detail?.trim() || engine.isJoined()) return;
    conferenceStore.$patch({
      error: normalizeSessionError(detail, 'conference'),
      conferenceObject: undefined,
      isJoined: false,
      isJoining: false,
    });
  });
  engine.on('userJoined', (id, user) => {
    conferenceStore.addUser(id, user);
    const props = sanitizeParticipantProperties(
      (user as { _properties?: Record<string, unknown> })._properties,
    );
    if ('handRaised' in props) {
      applyParticipantHandRaised(id, parseHandRaised(props.handRaised));
    }
    const local = useLocalStore();
    if (local.id && local.id !== id) {
      engine.sendCommand('hello', buildHelloCommand(local.id));
    }
    const features = useSessionFeaturesStore();
    if (features.isHost) {
      engine.sendCommand('host', JSON.stringify({ hostId: local.id }));
      engine.sendCommand(
        'access',
        JSON.stringify(grantsPayloadForSync(features.roomDefaults, id, features.userGrants)),
      );
      if (features.sharedNotes) {
        broadcastSharedNotes(engine, features.sharedNotes);
      }
      if (notesDocumentHasContent(features.ydoc)) {
        broadcastYjsState(engine, features.ydoc);
      }
    }
    if (features.isHost || features.isModerator) {
      broadcastHostRoomSettings(engine, features);
    }
    scheduleReceiverRefresh();
  });
  engine.on('userLeft', (id) => {
    clearStageIfParticipantLeft(id);
    conferenceStore.removeUser(id);
    useSessionFeaturesStore().rejectLobby(id);
  });
  engine.on('displayNameChanged', (id, displayName) => {
    conferenceStore.updateUserDisplayName(id, displayName);
  });
  engine.on('trackAdded', (track) => {
    const id = participantIdFromTrack(track);
    mediaDebugTrack('wiring', 'trackAdded', track, { resolvedParticipantId: id });
    if (!id) {
      mediaDebug('wiring', 'trackAdded:skipped', { reason: 'no-participant-id' });
      return;
    }
    if (!conferenceStore.users[id]) conferenceStore.addUser(id);
    applyRemoteTrackToStore(id, track);
  });
  engine.on('trackMuteChanged', (track) => {
    const id = participantIdFromTrack(track);
    mediaDebugTrack('wiring', 'trackMuteChanged', track, { resolvedParticipantId: id });
    if (!id) return;
    if (!conferenceStore.users[id]) conferenceStore.addUser(id);
    const isAudio = track.getType() === 'audio';
    if (!isAudio) {
      if (track.isMuted()) {
        if (track.videoType === 'desktop') {
          conferenceStore.clearUserTrack(id, 'screenshare');
        } else {
          conferenceStore.clearUserTrack(id, 'video');
        }
      } else {
        conferenceStore.setUserTrack(id, 'video', track);
      }
    } else {
      const user = conferenceStore.users[id]!;
      /* v8 ignore next */
      const trackId = (typeof track.getId === 'function') ? track.getId() : ((track as any).id || 'mock-track-id');
      const isScreenAudio = trackId === user.screenshareAudio?.getId();
      /* v8 ignore start */
      if (isScreenAudio) {
        if (track.isMuted()) {
          conferenceStore.clearUserTrack(id, 'screenshareAudio');
        } else {
          conferenceStore.setUserTrack(id, 'screenshareAudio', track);
        }
      }
      /* v8 ignore stop */
      else {
        if (track.isMuted()) {
          conferenceStore.patchUser(id, { mute: true });
          /* v8 ignore next */
          engine.disconnectParticipantAudio?.(id);
        } else {
          conferenceStore.setUserTrack(id, 'audio', track);
          engine.setParticipantVolume(id, playbackGainForUser(user, user.volume ?? 1));
        }
      }
    }
    if (track.getType() === 'video') emitMediaStateSnapshot('trackMuteChanged');
    scheduleReceiverRefresh();
  });
  engine.on('trackRemoved', (track) => {
    const id = participantIdFromTrack(track);
    const isAudio = track.getType() === 'audio';
    mediaDebugTrack('wiring', 'trackRemoved', track, { resolvedParticipantId: id, isAudio });
    if (!id) return;
    if (isAudio) {
      const user = conferenceStore.users[id];
      /* v8 ignore next */
      const trackId = (typeof track.getId === 'function') ? track.getId() : ((track as any).id || 'mock-track-id');
      const isScreenAudio = trackId === user?.screenshareAudio?.getId();
      /* v8 ignore start */
      if (isScreenAudio) {
        conferenceStore.clearUserTrack(id, 'screenshareAudio');
      }
      /* v8 ignore stop */
      else {
        /* v8 ignore next */
        engine.disconnectParticipantAudio?.(id);
        conferenceStore.clearUserTrack(id, 'audio');
      }
    } else {
      if (track.videoType === 'desktop') {
        conferenceStore.clearUserTrack(id, 'screenshare');
      } else {
        conferenceStore.clearUserTrack(id, 'video');
      }
    }
    if (track.getType() === 'video') emitMediaStateSnapshot('trackRemoved');
    scheduleReceiverRefresh();
  });
  engine.on('messageReceived', (id, text, nr) => {
    conferenceStore.ingestChatMessage(id, text, nr);
  });
  engine.on('participantPropertyChanged', (id, properties) => {
    const safe = sanitizeParticipantProperties(properties);
    if ('handRaised' in safe) {
      applyParticipantHandRaised(id, parseHandRaised(safe.handRaised));
      delete safe.handRaised;
    }
    if ('onStage' in safe) {
      const features = useSessionFeaturesStore();
      const local = useLocalStore();
      const onStage = isOnStage(safe.onStage);
      // NOTE: Do NOT call applyStagePromote/applyStageDemote here.
      // Those helpers call engine.setLocalParticipantProperty which triggers
      // another participantPropertyChanged, creating an infinite loop.
      // Instead, update store state directly (no engine re-broadcast).
      if (onStage && (!features.stageOccupantId || features.stageOccupantId === id)) {
        features.stageOccupantId = id;
        features.stageInvitationPending = false;
        features.invitedStageUserId = '';
        void stopLocalScreenshareIfNeeded(local.id, id);
        if (local.id === id) {
          local.setOnStage(true);
          // Don't re-call engine.setLocalParticipantProperty — we ARE responding to it.
        }
      } else if (!onStage && features.stageOccupantId === id) {
        features.stageOccupantId = '';
        features.stageLayout = defaultStageLayout();
        features.stageInvitationPending = false;
        features.invitedStageUserId = '';
        if (local.id === id) {
          local.setOnStage(false);
          // Don't re-call engine.setLocalParticipantProperty — we ARE responding to it.
        }
      }
    }
    const user = conferenceStore.users[id];
    if (!user || !Object.keys(safe).length) return;
    const patch: Partial<typeof user> = {
      properties: { ...user.properties, ...safe },
    };
    if ('speaking' in safe) {
      patch.speaking = safe.speaking === true || safe.speaking === 'true';
    }
    conferenceStore.patchUser(id, patch);
  });
  engine.on('participantSpeakingChanged', (id, speaking) => {
    if (!conferenceStore.users[id]) return;
    conferenceStore.patchUser(id, { speaking });
  });
  engine.on('command', (name, payload, senderId) => {
    handleSessionCommand(name, payload, senderId);
  });
}
