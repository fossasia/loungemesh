<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { ensureLocalTracks } from '@/composables/ensureLocalTracks';
import { throttle } from '@/utils/throttle';
import { getVolumeByDistance } from '@/utils/vector';
import { playbackGainForUser } from '@/utils/participantPlaybackGain';
import { applyWorkerVolume } from '@/components/runtime/applyWorkerVolume';
import { watchTrackSpeaking } from '@/utils/speakingMeter';
import { scheduleReceiverRefresh } from '@/utils/scheduleReceiverRefresh';
import { mediaDebug } from '@/utils/mediaDebug';
import { emitMediaStateSnapshot } from '@/utils/mediaStateSnapshot';

const { engine, createLocalTracks, setParticipantVolume } = useMediaEngine();
const conferenceStore = useConferenceStore();
const connectionStore = useConnectionStore();
const localStore = useLocalStore();

const throttledSendPos = throttle((pos: string) => {
  engine.sendCommand('pos', pos);
}, 200);

let worker: Worker | undefined;
let workerReady = false;
let stopSpeakingWatch: (() => void) | undefined;

function bindSpeakingMonitor() {
  stopSpeakingWatch?.();
  stopSpeakingWatch = undefined;
  if (!localStore.audio) {
    localStore.speaking = false;
    return;
  }
  stopSpeakingWatch = watchTrackSpeaking(localStore.audio, (speaking) => {
    localStore.speaking = speaking;
    if (conferenceStore.isJoined) {
      engine.setLocalParticipantProperty('speaking', speaking);
    }
  });
}

function applyVolumes(myPos: { x: number; y: number }) {
  for (const key of Object.keys(conferenceStore.users)) {
    const u = conferenceStore.users[key];
    const proximity = getVolumeByDistance(myPos, u.pos);
    const gain = playbackGainForUser(u, proximity);
    if (u.volume !== proximity) {
      conferenceStore.patchUser(key, { volume: proximity }, false);
    }
    setParticipantVolume(key, gain);
  }
}

// Callers gate this on `worker && workerReady`, so the worker is always present here.
function postWorkerUpdate(myPos: { x: number; y: number }) {
  const users = Object.values(conferenceStore.users).map((u) => ({
    id: u.id,
    pos: { x: u.pos.x, y: u.pos.y },
  }));
  worker!.postMessage({ myPos: { x: myPos.x, y: myPos.y }, users });
}

function initProximityWorker() {
  if (typeof Worker === 'undefined') return;
  try {
    worker = new Worker(new URL('@/workers/proximityAudio.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ volumes: Array<{ id: string; volume: number }> }>) => {
      for (const { id, volume } of e.data.volumes) {
        applyWorkerVolume(
          id,
          volume,
          conferenceStore.users,
          (userId, patch) => conferenceStore.patchUser(userId, patch, false),
          setParticipantVolume,
        );
      }
      localStore.calculateUsersOnScreen();
    };
    workerReady = true;
  } catch {
    worker = undefined;
  }
}

async function requestMedia() {
  try {
    await ensureLocalTracks(localStore, engine);
  } catch {
    /* user denied or device unavailable */
  }
}

let publishingLocalTracks = false;

async function addLocalTracksToConference() {
  const conf = engine.getConference();
  if (!conferenceStore.isJoined || !conf || publishingLocalTracks) return;
  publishingLocalTracks = true;
  try {
    const alreadyPublished = conf.getLocalTracks?.() ?? [];
    for (const track of [localStore.audio, localStore.video]) {
      if (!track) continue;
      if (alreadyPublished.some((existing) => existing === track || existing.getType() === track.getType())) {
        continue;
      }
      try {
        await engine.addLocalTrack(track);
        mediaDebug('LocalStoreLogic', 'publishLocalTrack', {
          type: track.getType?.(),
          result: 'added',
        });
      } catch (err) {
        mediaDebug('LocalStoreLogic', 'publishLocalTrack:failed', {
          type: track.getType?.(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    scheduleReceiverRefresh();
    emitMediaStateSnapshot('addLocalTracksToConference');
  } finally {
    publishingLocalTracks = false;
  }
}

function onResize() {
  localStore.resetViewportForRoom();
}

onMounted(() => {
  initProximityWorker();
  void requestMedia();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  worker?.terminate();
  stopSpeakingWatch?.();
});

watch(
  () => connectionStore.connected,
  (connected) => {
    if (connected) void requestMedia();
  },
);

watch(
  () => conferenceStore.conferenceObject,
  () => {
    const id = engine.getLocalUserId();
    if (id) localStore.setMyID(id);
  },
  { immediate: true },
);

watch(
  () => conferenceStore.isJoined,
  async (joined) => {
    if (!joined) return;
    await requestMedia();
    await addLocalTracksToConference();
    localStore.publishLocalPosition();
  },
  { immediate: true },
);

watch(
  () => [conferenceStore.isJoined, localStore.audio, localStore.video] as const,
  () => {
    void addLocalTracksToConference();
  },
);

watch(() => localStore.audio, bindSpeakingMonitor, { immediate: true });

watch(
  () => conferenceStore.usersEpoch,
  () => {
    localStore.ensureRoomBounds();
    if (!localStore.id) return;
    if (worker && workerReady) {
      postWorkerUpdate(localStore.pos);
    } else {
      applyVolumes(localStore.pos);
      localStore.calculateUsersOnScreen();
    }
  },
);

watch(
  () => ({ pos: localStore.pos, id: localStore.id }),
  ({ pos, id }) => {
    if (!id) return;
    throttledSendPos(JSON.stringify({ ...pos, id }));

    if (worker && workerReady) {
      postWorkerUpdate(pos);
    } else {
      applyVolumes(pos);
      localStore.calculateUsersOnScreen();
    }
  },
  { deep: true },
);
</script>

<template>
  <span style="display: none" />
</template>
