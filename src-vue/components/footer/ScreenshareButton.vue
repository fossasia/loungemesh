<script setup lang="ts">
import { ref } from 'vue';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import IconButton from '@/components/ui/IconButton.vue';
import ScreenShareIcon from '@/components/icons/ScreenShareIcon.vue';

const connection = useConnectionStore();
const conference = useConferenceStore();
const local = useLocalStore();
const sharing = ref(false);

async function toggleShare() {
  const jsMeet = connection.jsMeet;
  const conf = conference.conferenceObject;
  if (!jsMeet || !conf) return;

  const oldTrack = conf.getLocalVideoTrack?.();
  const wantDesktop = oldTrack?.videoType !== 'desktop';

  try {
    const tracks = await jsMeet.createLocalTracks({ devices: [wantDesktop ? 'desktop' : 'video'] });
    const newTrack = tracks[0];
    const isDesktop = newTrack?.videoType === 'desktop';

    if (oldTrack) {
      await conf.replaceTrack?.(oldTrack, newTrack);
      oldTrack.dispose?.();
    } else {
      await conf.addTrack?.(newTrack);
    }
    const list: unknown[] = [];
    if (local.audio) list.push(local.audio);
    if (newTrack) list.push(newTrack);
    local.setLocalTracks(list as any[]);
    sharing.value = !!isDesktop;
  } catch (e) {
    console.error(e);
  }
}
</script>

<template>
  <IconButton label="Screenshare" :active="sharing" @click="toggleShare">
    <template #icon><ScreenShareIcon class="svg" /></template>
  </IconButton>
</template>

<style scoped>
.svg :deep(path),
.svg :deep(rect),
.svg :deep(ellipse) {
  stroke: var(--btn-default-fg);
}
</style>
