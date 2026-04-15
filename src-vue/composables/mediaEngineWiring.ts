import type { MediaService } from '@/services/MediaService';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';

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
      conferenceObject: engine.getConference(),
    });
    const id = engine.getLocalUserId();
    if (id) useLocalStore().setMyID(id);
  });
  engine.on('conferenceError', (detail) => {
    conferenceStore.$patch({
      error: detail,
      conferenceObject: undefined,
      isJoined: false,
      isJoining: false,
    });
  });
  engine.on('userJoined', (id, user) => {
    conferenceStore.addUser(id, user);
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
    conferenceStore.messages = [...conferenceStore.messages, { id, text, nr }];
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
  });
  engine.on('command', (_name, payload) => {
    try {
      const pos = JSON.parse(payload.value) as { id?: string; x?: number; y?: number };
      if (pos?.id != null && pos.x != null && pos.y != null) {
        conferenceStore.updateUserPosition(pos.id, { x: pos.x, y: pos.y });
      }
    } catch {
      /* ignore malformed */
    }
  });
}
