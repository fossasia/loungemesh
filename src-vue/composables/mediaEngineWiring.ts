import { markRaw } from 'vue';
import type { MediaService } from '@/services/MediaService';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { handleSessionCommand } from '@/utils/sessionCommands';
import { grantsPayloadForSync } from '@/utils/sessionAccess';

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
    conferenceStore.$patch({
      isJoined: true,
      isJoining: false,
      error: undefined,
      conferenceObject: markRaw(engine.getConference() as object),
    });
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
    }
  });
  engine.on('userLeft', (id) => {
    conferenceStore.removeUser(id);
  });
  engine.on('trackAdded', (track) => {
    const id = track.getParticipantId?.();
    if (!id) return;
    if (!conferenceStore.users[id]) conferenceStore.addUser(id);
    if (track.getType() === 'audio') {
      conferenceStore.users[id].audio = track;
      conferenceStore.users[id].mute = track.isMuted();
    } else {
      conferenceStore.users[id].video = track;
      conferenceStore.users[id].videoType = track.videoType === 'desktop' ? 'desktop' : 'camera';
    }
  });
  engine.on('messageReceived', (id, text, nr) => {
    conferenceStore.ingestChatMessage(id, text, nr);
  });
  engine.on('participantPropertyChanged', (id, properties) => {
    if (!conferenceStore.users[id]) return;
    conferenceStore.users[id].properties = {
      ...conferenceStore.users[id].properties,
      ...properties,
    };
    if ('speaking' in properties) {
      const speaking =
        properties.speaking === true || properties.speaking === 'true';
      conferenceStore.users[id].speaking = speaking;
    }
    if ('handRaised' in properties) {
      conferenceStore.users[id].properties.handRaised = properties.handRaised;
    }
  });
  engine.on('command', (name, payload) => {
    handleSessionCommand(name, payload);
  });
}
