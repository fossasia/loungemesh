<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { throttle } from '@/utils/throttle';
import { getVolumeByDistance } from '@/utils/vector';
import { applyWorkerVolume } from '@/components/runtime/applyWorkerVolume';

const { engine, createLocalTracks, setParticipantVolume } = useMediaEngine();
const conferenceStore = useConferenceStore();
const localStore = useLocalStore();

const throttledSendPos = throttle((pos: string) => {
  engine.sendCommand('pos', pos);
}, 200);

let worker: Worker | undefined;
let workerReady = false;

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

onMounted(() => {
  initProximityWorker();
});

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
    if (localStore.audio && localStore.video) return;
    try {
      const tracks = await createLocalTracks(['audio', 'video']);
      localStore.setLocalTracks(tracks);
    } catch {
      /* permissions denied */
    }
  },
  { immediate: true },
);

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

watch(
  () => [conferenceStore.isJoined, localStore.audio, localStore.video],
  () => {
    void addLocalTracksToConference();
  },
  { deep: true },
);

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
