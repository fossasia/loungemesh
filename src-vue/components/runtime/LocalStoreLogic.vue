<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { getVolumeByDistance } from '@/utils/vector';

function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number): T {
  let last = 0;
  let timeout: number | undefined;
  let pendingArgs: any[] | undefined;
  const run = () => {
    last = Date.now();
    timeout = undefined;
    if (pendingArgs) fn(...pendingArgs);
    pendingArgs = undefined;
  };
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    if (remaining <= 0) {
      pendingArgs = args;
      run();
      return;
    }
    pendingArgs = args;
    if (timeout) return;
    timeout = window.setTimeout(run, remaining);
  }) as T;
}

const connectionStore = useConnectionStore();
const conferenceStore = useConferenceStore();
const localStore = useLocalStore();

const throttledSendPos = throttle((pos: string) => {
  conferenceStore.conferenceObject?.sendCommand?.('pos', { value: pos });
}, 200);

onMounted(async () => {
  await connectionStore.initJitsiMeet();
});

watch(
  () => conferenceStore.conferenceObject,
  (conf) => {
    const id = conf?.myUserId?.();
    if (id) localStore.setMyID(id);
  },
  { immediate: true }
);

watch(
  () => connectionStore.jsMeet,
  async (jsMeet) => {
    if (!jsMeet) return;
    /* Pinia survives Enter → Session; avoid a second createLocalTracks + leaked devices. */
    if (localStore.audio && localStore.video) return;
    try {
      const tracks = await jsMeet.createLocalTracks({
        devices: ['audio', 'video'],
        firePermissionPromptIsShownEvent: true,
      });
      localStore.setLocalTracks(tracks);
    } catch {
      // ignore for now
    }
  },
  { immediate: true }
);

/** Publish mic/camera to the room once the conference is joined (required for remote A/V). */
async function addLocalTracksToConference() {
  const conf = conferenceStore.conferenceObject;
  if (!conferenceStore.isJoined || !conf) return;
  for (const track of [localStore.audio, localStore.video]) {
    if (!track) continue;
    try {
      await conf.addTrack?.(track);
    } catch {
      /* already in conference or unsupported */
    }
  }
}

watch(
  () => [conferenceStore.isJoined, conferenceStore.conferenceObject, localStore.audio, localStore.video],
  () => {
    void addLocalTracksToConference();
  },
  { deep: true }
);

watch(
  () => ({ pos: localStore.pos, id: localStore.id }),
  ({ pos, id }) => {
    if (!id) return;
    throttledSendPos(JSON.stringify({ ...pos, id }));

    // update volumes for all remote users
    for (const key of Object.keys(conferenceStore.users)) {
      const u = conferenceStore.users[key];
      u.volume = getVolumeByDistance(pos, u.pos);
    }
    localStore.calculateUsersOnScreen();
  },
  { deep: true }
);
</script>

<template>
  <span style="display: none" />
</template>

