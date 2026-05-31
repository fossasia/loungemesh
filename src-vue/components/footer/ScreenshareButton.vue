<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useLocalStore } from '@/stores/localStore';
import { restoreCameraVideo } from '@/composables/restoreCameraVideo';
import { bindScreenshareEndWatch } from '@/utils/screenshareDesktopWatch';
import { disposeJitsiTrack } from '@/utils/disposeJitsiTrack';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { engine } = useMediaEngine();
const local = useLocalStore();
const sharing = ref(false);
let stopEndedWatch: (() => void) | undefined;

function bindDesktopEndWatch() {
  stopEndedWatch?.();
  stopEndedWatch = bindScreenshareEndWatch(local.video, () => {
    void finishShare();
  });
}

async function finishShare() {
  sharing.value = false;
  await restoreCameraVideo(engine, local);
}

async function startShare() {
  const conf = engine.getConference()!;
  const oldTrack = conf.getLocalVideoTrack?.();
  const tracks = await engine.createLocalTracks(['desktop']);
  const newTrack = tracks.find((t) => t.getType?.() === 'video') ?? tracks[0];
  if (!newTrack || newTrack.videoType !== 'desktop') return;

  if (oldTrack) {
    await engine.replaceLocalTrack(oldTrack, newTrack);
    disposeJitsiTrack(oldTrack);
  } else {
    await engine.addLocalTrack(newTrack);
  }
  const list = [];
  if (local.audio) list.push(local.audio);
  list.push(newTrack);
  local.setLocalTracks(list);
  sharing.value = true;
  bindDesktopEndWatch();
}

async function stopShare() {
  await finishShare();
}

async function toggleShare() {
  const conf = engine.getConference();
  if (!conf) return;
  const oldTrack = conf.getLocalVideoTrack?.();
  if (oldTrack?.videoType === 'desktop' || sharing.value) {
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
  () => local.video?.videoType,
  (type) => {
    sharing.value = type === 'desktop';
    if (type === 'desktop') bindDesktopEndWatch();
    else stopEndedWatch?.();
  },
  { immediate: true },
);

onUnmounted(() => {
  stopEndedWatch?.();
  if (sharing.value || local.videoType === 'desktop') {
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
