import { readonly, ref, shallowRef } from 'vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import type { MediaService } from '@/services/MediaService';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import type { JitsiTrack } from '@/types/jitsi';

function getEngine(): MediaService {
  return getMediaEngineInstance();
}

function wireStoreSync(engine: MediaService): void {
  const connectionStore = useConnectionStore();
  const conferenceStore = useConferenceStore();

  engine.on('connected', () => {
    connectionStore.$patch({ connected: true, error: undefined });
  });
  engine.on('disconnected', () => {
    connectionStore.$patch({ connected: false });
  });
  engine.on('connectionFailed', (detail) => {
    connectionStore.$patch({ connected: false, error: detail, connection: undefined });
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
  });
  engine.on('command', (name, payload) => {
    if (name !== 'pos') return;
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

let wired = false;

export function useMediaEngine() {
  const engine = getEngine();
  if (!wired) {
    wireStoreSync(engine);
    wired = true;
  }

  const connected = ref(engine.isConnected());
  const joined = ref(engine.isJoined());
  const engineError = shallowRef<string | undefined>(undefined);

  engine.on('connected', () => {
    connected.value = true;
    engineError.value = undefined;
  });
  engine.on('disconnected', () => {
    connected.value = false;
  });
  engine.on('connectionFailed', (d) => {
    connected.value = false;
    engineError.value = d;
  });
  engine.on('conferenceJoined', () => {
    joined.value = true;
  });
  engine.on('conferenceError', (d) => {
    joined.value = false;
    engineError.value = d;
  });

  return {
    engine,
    connected: readonly(connected),
    joined: readonly(joined),
    engineError: readonly(engineError),
    async connect() {
      await engine.connect();
      connected.value = engine.isConnected();
    },
    disconnect() {
      engine.disconnect();
      connected.value = false;
      joined.value = false;
    },
    async joinRoom(room: string, displayName: string, conferenceOptions: Record<string, unknown>) {
      const conferenceStore = useConferenceStore();
      if (conferenceStore.isJoining) return;
      conferenceStore.isJoining = true;
      conferenceStore.conferenceObject = engine.getConference() as never;
      try {
        await engine.joinRoom(room, displayName, conferenceOptions);
        conferenceStore.conferenceObject = engine.getConference() as never;
        joined.value = engine.isJoined();
      } catch (e) {
        conferenceStore.isJoining = false;
        throw e;
      }
    },
    leaveRoom() {
      engine.leaveRoom();
      joined.value = false;
    },
    setParticipantVolume(userId: string, gain: number) {
      engine.setParticipantVolume(userId, gain);
    },
    async createLocalTracks(devices: ('audio' | 'video' | 'desktop')[]): Promise<JitsiTrack[]> {
      return engine.createLocalTracks(devices);
    },
    getConference() {
      return engine.getConference();
    },
  };
}
