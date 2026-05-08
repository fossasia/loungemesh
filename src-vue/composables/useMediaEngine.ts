import { readonly, ref, shallowRef } from 'vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import type { MediaService } from '@/services/MediaService';
import { useConferenceStore } from '@/stores/conferenceStore';
import type { JitsiTrack } from '@/types/jitsi';
import { refreshJwt, getStoredJwt } from '@/composables/useAccessGuard';
import { setJwtRefreshCallback } from '@/composables/useEvenytayBridge';
import { isMediaEngineWired, markMediaEngineWired } from '@/composables/mediaEngineWiringState';
import { wireStoreSync } from '@/composables/mediaEngineWiring';
import { runConferenceJoin } from '@/composables/joinConferenceRoom';
import { installMediaPlaybackUnlock } from '@/utils/resumeMediaPlayback';

function getEngine(): MediaService {
  return getMediaEngineInstance();
}

function wireTokenRefresh(engine: MediaService): void {
  // Register the token refresh function with the media engine.
  // The engine calls this when Jitsi fires AUTHENTICATION_REQUIRED.
  engine.onTokenExpired(async () => {
    const newJwt = await refreshJwt();
    return newJwt;
  });
  // Register the callback for token refresh initiated by the Eventyay parent window.
  setJwtRefreshCallback((jwt: string) => {
    // Reconnect directly with the injected JWT.
    void engine.connect({ jwt } as never);
  });
}

export function useMediaEngine() {
  const engine = getEngine();
  if (!isMediaEngineWired()) {
    wireStoreSync(engine);
    wireTokenRefresh(engine);
    installMediaPlaybackUnlock(engine);
    markMediaEngineWired();
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
    if (!engine.isJoined()) {
      joined.value = false;
      engineError.value = d;
    }
  });

  return {
    engine,
    connected: readonly(connected),
    joined: readonly(joined),
    engineError: readonly(engineError),
    async connect(opts?: { jwt?: string; appId?: string }) {
      const jwt = opts?.jwt ?? getStoredJwt() ?? undefined;
      await engine.connect(jwt ? { jwt } : undefined);
      connected.value = engine.isConnected();
    },
    disconnect() {
      engine.disconnect();
      connected.value = false;
      joined.value = false;
    },
    async joinRoom(room: string, displayName: string, conferenceOptions: Record<string, unknown>) {
      const conferenceStore = useConferenceStore();
      await runConferenceJoin(engine, conferenceStore, room, displayName, conferenceOptions);
      joined.value = engine.isJoined();
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
