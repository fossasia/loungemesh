<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useLocalStore } from '@/stores/localStore';
import { bindScreenshareEndWatch } from '@/utils/screenshareDesktopWatch';
import { releaseLocalMediaTracks } from '@/utils/releaseLocalMedia';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { engine } = useMediaEngine();
const local = useLocalStore();
const sharing = ref(false);
let stopEndedWatch: (() => void) | undefined;

function bindDesktopEndWatch() {
  stopEndedWatch?.();
  stopEndedWatch = bindScreenshareEndWatch(local.screenshare, () => {
    void finishShare();
  });
}

async function finishShare() {
  sharing.value = false;
  const track = local.screenshare;
  if (track) {
    local.screenshare = undefined;
    await releaseLocalMediaTracks([track], engine.getConference());
  }
}

async function startShare() {
  const conf = engine.getConference()!;
  const tracks = await engine.createLocalTracks(['desktop']);
  const newTrack = tracks.find((t) => t.getType?.() === 'video') ?? tracks[0];
  if (!newTrack || newTrack.videoType !== 'desktop') return;

  await engine.addLocalTrack(newTrack);
  local.screenshare = newTrack;
  sharing.value = true;
  bindDesktopEndWatch();
}

async function stopShare() {
  await finishShare();
}

async function toggleShare() {
  const conf = engine.getConference();
  if (!conf) return;
  if (local.screenshare || sharing.value) {
    await stopShare();
    return;
  }
  try {
    await startShare();
  } catch {
    sharing.value = false;
  }
}

watch(
  () => local.screenshare,
  (track) => {
    sharing.value = !!track;
    if (track) bindDesktopEndWatch();
    else stopEndedWatch?.();
  },
  { immediate: true },
);

onUnmounted(() => {
  stopEndedWatch?.();
  if (sharing.value || local.screenshare) {
    void finishShare();
  }
});
</script>

<template>
  <IconButton
    label="Screenshare"
    :active="sharing"
    :sound="sharing ? 'toggleOff' : 'toggleOn'"
    @click="toggleShare"
  >
    <template #icon><AppIcon name="monitor-up" /></template>
  </IconButton>
</template>
