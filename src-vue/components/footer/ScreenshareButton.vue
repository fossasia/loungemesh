<script setup lang="ts">
import { ref } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useLocalStore } from '@/stores/localStore';
import IconButton from '@/components/ui/IconButton.vue';
import ScreenShareIcon from '@/components/icons/ScreenShareIcon.vue';

const { engine } = useMediaEngine();
const local = useLocalStore();
const sharing = ref(false);

async function toggleShare() {
  const conf = engine.getConference();
  if (!conf) return;

  const oldTrack = conf.getLocalVideoTrack?.();
  const wantDesktop = oldTrack?.videoType !== 'desktop';

  try {
    const tracks = await engine.createLocalTracks([wantDesktop ? 'desktop' : 'video']);
    const newTrack = tracks[0];
    const isDesktop = newTrack?.videoType === 'desktop';

    if (oldTrack) {
      await engine.replaceLocalTrack(oldTrack, newTrack);
      (oldTrack as unknown as { dispose?: () => void }).dispose?.();
    } else {
      await engine.addLocalTrack(newTrack);
    }
    const list = [];
    if (local.audio) list.push(local.audio);
    if (newTrack) list.push(newTrack);
    local.setLocalTracks(list);
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
