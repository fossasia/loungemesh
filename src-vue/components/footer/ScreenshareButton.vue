<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { bindScreenshareEndWatch } from '@/utils/screenshareDesktopWatch';
import { stopLocalScreenshare } from '@/utils/localScreenshare';
import { shouldAllowScreenshare } from '@/utils/sessionStage';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { engine } = useMediaEngine();
const local = useLocalStore();
const features = useSessionFeaturesStore();
const sharing = ref(false);
let stopEndedWatch: (() => void) | undefined;

const screenshareBlocked = computed(
  () => !shouldAllowScreenshare(local.id, features.stageOccupantId) && !sharing.value,
);

const screenshareTitle = computed(() =>
  screenshareBlocked.value
    ? 'Screen sharing is unavailable while someone is on stage.'
    : 'Screenshare',
);

function bindDesktopEndWatch() {
  stopEndedWatch?.();
  stopEndedWatch = bindScreenshareEndWatch(local.screenshare, () => {
    void finishShare();
  });
}

async function finishShare() {
  sharing.value = false;
  await stopLocalScreenshare();
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
  if (screenshareBlocked.value) return;
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

watch(
  () => features.stageOccupantId,
  (occupantId) => {
    if (!occupantId || occupantId === local.id) return;
    if (local.screenshare || sharing.value) void finishShare();
  },
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
    :label="screenshareTitle"
    :title="screenshareTitle"
    :active="sharing"
    :disabled="screenshareBlocked"
    :sound="sharing ? 'toggleOff' : 'toggleOn'"
    @click="toggleShare"
  >
    <template #icon><AppIcon name="monitor-up" /></template>
  </IconButton>
</template>
