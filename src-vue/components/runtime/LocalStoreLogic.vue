<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLocalStore } from '@/stores/localStore';
import { ensureLocalTracks } from '@/composables/ensureLocalTracks';
import { throttle } from '@/utils/throttle';
import { getVolumeByDistance } from '@/utils/vector';
import { applyWorkerVolume } from '@/components/runtime/applyWorkerVolume';
import { watchTrackSpeaking } from '@/utils/speakingMeter';

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
    const vol = getVolumeByDistance(myPos, u.pos);
    u.volume = vol;
    setParticipantVolume(key, vol);
  }
}

function initProximityWorker() {
  if (typeof Worker === 'undefined') return;
  try {
    worker = new Worker(new URL('@/workers/proximityAudio.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ volumes: Array<{ id: string; volume: number }> }>) => {
      for (const { id, volume } of e.data.volumes) {
        applyWorkerVolume(id, volume, conferenceStore.users, setParticipantVolume);
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

async function addLocalTracksToConference() {
  const conf = engine.getConference();
  if (!conferenceStore.isJoined || !conf) return;
  for (const track of [localStore.audio, localStore.video]) {
    if (!track) continue;
    try {
      await engine.addLocalTrack(track);
    } catch {
      /* already added */
    }
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
  () => [conferenceStore.isJoined, localStore.audio, localStore.video],
  () => {
    void addLocalTracksToConference();
  },
  { deep: true },
);

watch(() => localStore.audio, bindSpeakingMonitor, { immediate: true });

watch(
  () => ({ pos: localStore.pos, id: localStore.id }),
  ({ pos, id }) => {
    if (!id) return;
    throttledSendPos(JSON.stringify({ ...pos, id }));

    if (worker && workerReady) {
      const users = Object.values(conferenceStore.users).map((u) => ({
        id: u.id,
        pos: u.pos,
      }));
      worker.postMessage({ myPos: pos, users });
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
