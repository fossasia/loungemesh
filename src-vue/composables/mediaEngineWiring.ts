import { markRaw } from 'vue';
import type { MediaService } from '@/services/MediaService';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { handleSessionCommand } from '@/utils/sessionCommands';
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
import { broadcastSharedNotes } from '@/utils/notesSync';
import { isOnStage } from '@/components/stage/isOnStage';
import { defaultStageLayout } from '@/stores/sessionFeaturesStore';
import {
  clearStageIfParticipantLeft,
  stopLocalScreenshareIfNeeded,
} from '@/utils/sessionStage';

/** Wire media engine events into Pinia stores (called once per app lifetime). */
export function wireStoreSync(engine: MediaService): void {
  const conferenceStore = useConferenceStore();

  engine.on('connected', () => {
    useConnectionStore().$patch({ connected: true, error: undefined });
  });
  engine.on('disconnected', () => {
    useConnectionStore().$patch({ connected: false });
  });
  engine.on('connectionFailed', (detail) => {
    mediaDebug('wiring', 'connectionFailed', { detail });
    useConnectionStore().$patch({
      connected: false,
      error: normalizeSessionError(detail, 'connection'),
      connection: undefined,
    });
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
      if (!features.isFetchingConfig) {
        features.syncOrClaimHostOnLoaded(engine);
      }
      const others = Object.values(conferenceStore.users).map((u) => u.pos);
      local.setLocalPosition(spreadInitialUserPosition(others));
      local.publishLocalPosition();
      scheduleReceiverRefresh();
      emitMediaStateSnapshot('conferenceJoined');
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
    const features = useSessionFeaturesStore();
    if (features.isHost) {
      const local = useLocalStore();
      engine.sendCommand('host', JSON.stringify({ hostId: local.id }));
      engine.sendCommand(
        'access',
        JSON.stringify(grantsPayloadForSync(features.roomDefaults, id, features.userGrants)),
      );
      if (features.sharedNotes) {
        broadcastSharedNotes(engine, features.sharedNotes);
      }
      broadcastHostRoomSettings(engine, features);
    }
    scheduleReceiverRefresh();
  });
  engine.on('userLeft', (id) => {
    clearStageIfParticipantLeft(id);
    conferenceStore.removeUser(id);
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
    const kind = track.getType() === 'audio' ? 'audio' : 'video';
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
  });
  engine.on('trackMuteChanged', (track) => {
    const id = participantIdFromTrack(track);
    mediaDebugTrack('wiring', 'trackMuteChanged', track, { resolvedParticipantId: id });
    if (!id) return;
    if (!conferenceStore.users[id]) conferenceStore.addUser(id);
    const kind = track.getType() === 'audio' ? 'audio' : 'video';
    if (kind === 'video') {
      if (track.isMuted()) {
        if (track.videoType === 'desktop') {
          conferenceStore.clearUserTrack(id, 'screenshare');
        } else {
          conferenceStore.clearUserTrack(id, 'video');
        }
      } else {
        conferenceStore.setUserTrack(id, kind, track);
      }
    } else if (track.isMuted()) {
      conferenceStore.patchUser(id, { mute: true });
      engine.disconnectParticipantAudio?.(id);
    } else {
      conferenceStore.setUserTrack(id, kind, track);
      const user = conferenceStore.users[id]!;
      engine.setParticipantVolume(id, playbackGainForUser(user, user.volume ?? 1));
    }
    if (kind === 'video') emitMediaStateSnapshot('trackMuteChanged');
    scheduleReceiverRefresh();
  });
  engine.on('trackRemoved', (track) => {
    const id = participantIdFromTrack(track);
    const kind = track.getType() === 'audio' ? 'audio' : 'video';
    mediaDebugTrack('wiring', 'trackRemoved', track, { resolvedParticipantId: id, kind });
    if (!id) return;
    if (kind === 'audio') engine.disconnectParticipantAudio?.(id);
    if (kind === 'video') {
      if (track.videoType === 'desktop') {
        conferenceStore.clearUserTrack(id, 'screenshare');
      } else {
        conferenceStore.clearUserTrack(id, 'video');
      }
    } else {
      conferenceStore.clearUserTrack(id, kind);
    }
    if (kind === 'video') emitMediaStateSnapshot('trackRemoved');
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
  engine.on('command', (name, payload) => {
    handleSessionCommand(name, payload);
  });
}
