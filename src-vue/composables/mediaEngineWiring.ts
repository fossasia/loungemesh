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
    useConnectionStore().$patch({ connected: false, error: detail, connection: undefined });
  });
  engine.on('conferenceJoined', () => {
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
      if (features.pendingHostClaim) {
        features.pendingHostClaim = false;
        features.setHost(id);
        features.approveLobby(id);
        engine.sendCommand('host', JSON.stringify({ hostId: id }));
        engine.sendCommand('access', JSON.stringify({ defaults: features.roomDefaults }));
      } else if (!features.hostId) {
        features.setHost(id);
        features.approveLobby(id);
        engine.sendCommand('host', JSON.stringify({ hostId: id }));
        engine.sendCommand('access', JSON.stringify({ defaults: features.roomDefaults }));
      } else if (features.lobbyEnabled && !features.lobbyApproved[id]) {
        features.localLobbyPending = true;
        engine.sendCommand(
          'lobby',
          JSON.stringify({
            action: 'wait',
            id,
            name: useConferenceStore().displayName,
          }),
        );
      }
      const others = Object.values(conferenceStore.users).map((u) => u.pos);
      local.setLocalPosition(spreadInitialUserPosition(others));
      local.publishLocalPosition();
      scheduleReceiverRefresh();
    }
  });
  engine.on('conferenceError', (detail) => {
    if (!detail?.trim() || engine.isJoined()) return;
    conferenceStore.$patch({
      error: detail,
      conferenceObject: undefined,
      isJoined: false,
      isJoining: false,
    });
  });
  engine.on('userJoined', (id, user) => {
    conferenceStore.addUser(id, user);
    const features = useSessionFeaturesStore();
    if (features.isHost) {
      engine.sendCommand(
        'access',
        JSON.stringify(grantsPayloadForSync(features.roomDefaults, id, features.userGrants)),
      );
      if (features.sharedNotes) {
        engine.sendCommand('notes', JSON.stringify({ text: features.sharedNotes }));
      }
    }
    scheduleReceiverRefresh();
  });
  engine.on('userLeft', (id) => {
    conferenceStore.removeUser(id);
  });
  engine.on('displayNameChanged', (id, displayName) => {
    conferenceStore.updateUserDisplayName(id, displayName);
  });
  engine.on('trackAdded', (track) => {
    const id = participantIdFromTrack(track);
    if (!id) return;
    if (!conferenceStore.users[id]) conferenceStore.addUser(id);
    const kind = track.getType() === 'audio' ? 'audio' : 'video';
    conferenceStore.setUserTrack(id, kind, track);
    if (kind === 'audio') {
      const user = conferenceStore.users[id]!;
      const proximity = track.isMuted() ? 0 : (user.volume ?? 1);
      engine.setParticipantVolume(id, playbackGainForUser(user, proximity));
    }
    scheduleReceiverRefresh();
  });
  engine.on('trackMuteChanged', (track) => {
    const id = participantIdFromTrack(track);
    if (!id) return;
    if (!conferenceStore.users[id]) conferenceStore.addUser(id);
    const kind = track.getType() === 'audio' ? 'audio' : 'video';
    if (kind === 'audio' && track.isMuted()) {
      conferenceStore.patchUser(id, { mute: true });
      engine.setParticipantVolume(id, 0);
    } else {
      conferenceStore.setUserTrack(id, kind, track);
      if (kind === 'audio') {
        const user = conferenceStore.users[id]!;
        engine.setParticipantVolume(id, playbackGainForUser(user, user.volume ?? 1));
      }
    }
    scheduleReceiverRefresh();
  });
  engine.on('trackRemoved', (track) => {
    const id = participantIdFromTrack(track);
    if (!id) return;
    const kind = track.getType() === 'audio' ? 'audio' : 'video';
    conferenceStore.clearUserTrack(id, kind);
    scheduleReceiverRefresh();
  });
  engine.on('messageReceived', (id, text, nr) => {
    conferenceStore.ingestChatMessage(id, text, nr);
  });
  engine.on('participantPropertyChanged', (id, properties) => {
    const user = conferenceStore.users[id];
    if (!user) return;
    const safe = sanitizeParticipantProperties(properties);
    const patch: Partial<typeof user> = {
      properties: { ...user.properties, ...safe },
    };
    if ('speaking' in safe) {
      patch.speaking = safe.speaking === true || safe.speaking === 'true';
    }
    if ('handRaised' in safe) {
      patch.properties = { ...patch.properties!, handRaised: safe.handRaised };
    }
    conferenceStore.patchUser(id, patch);
  });
  engine.on('command', (name, payload) => {
    handleSessionCommand(name, payload);
  });
}
