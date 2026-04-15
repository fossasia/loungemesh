<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import UserBackdrop from './overlays/UserBackdrop.vue';
import LocalAudioRing from './overlays/LocalAudioRing.vue';
import LocalNameContainer from './LocalNameContainer.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';
import SpeakingRing from './overlays/SpeakingRing.vue';

const props = withDefaults(
  defineProps<{
    draggable?: boolean;
  }>(),
  { draggable: true },
);

const local = useLocalStore();
const videoEl = ref<HTMLVideoElement | null>(null);
const audioEl = ref<HTMLAudioElement | null>(null);

let dragging = false;
let clickDelta = { x: 0, y: 0 };

const style = computed(() => ({
  position: 'absolute' as const,
  width: '200px',
  left: `${local.pos.x}px`,
  top: `${local.pos.y}px`,
}));

const userId = computed(() => local.id || 'localUser');
const isDesktop = computed(() => local.videoType === 'desktop');
const hasVideo = computed(() => !!local.video);

function attach() {
  if (local.video && videoEl.value) {
    try {
      local.video.detach?.(videoEl.value);
    } catch {
      /* ignore */
    }
    local.video.attach?.(videoEl.value);
  }
  if (local.audio && audioEl.value) local.audio.attach?.(audioEl.value);
}

function detach() {
  if (local.video && videoEl.value) local.video.detach?.(videoEl.value);
  if (local.audio && audioEl.value) local.audio.detach?.(audioEl.value);
}

watch(
  () => [local.video, local.videoType],
  async () => {
    await nextTick();
    attach();
  },
);

function onPointerDown(e: PointerEvent) {
  if (!props.draggable || e.button !== 0) return;
  e.stopPropagation();
  const el = e.currentTarget as HTMLElement;
  dragging = true;
  const rect = el.getBoundingClientRect();
  const scale = local.scale || 1;
  clickDelta = {
    x: (e.clientX - rect.left) / scale,
    y: (e.clientY - rect.top) / scale,
  };
  el.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  const scale = local.scale || 1;
  const pan = local.pan;
  const xPos = Math.trunc((e.clientX - pan.x) / scale - clickDelta.x);
  const yPos = Math.trunc((e.clientY - pan.y) / scale - clickDelta.y);
  local.setLocalPosition({ x: xPos, y: yPos });
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  const el = e.currentTarget as HTMLElement;
  try {
    el.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
}

onMounted(attach);
onBeforeUnmount(detach);
</script>

<template>
  <div
    :id="userId"
    class="local userContainer"
    :class="{ desktop: isDesktop }"
    :style="style"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <LocalAudioRing />
    <div class="videoContainer" :class="{ desktop: isDesktop }">
      <SpeakingRing :active="local.speaking && !local.mute" />
      <UserBackdrop :onStage="local.onStage" />
      <MuteIndicator v-if="local.mute" clickable @click="local.toggleMute()" />
      <video
        v-show="hasVideo"
        ref="videoEl"
        autoplay
        playsinline
        muted
        :class="isDesktop ? 'desktopVid' : 'vid'"
      />
      <div v-if="isDesktop && !hasVideo" class="sharePlaceholder">Starting screen share…</div>
    </div>
    <audio ref="audioEl" autoplay muted />
    <LocalNameContainer />
  </div>
</template>

<style scoped>
.videoContainer {
  width: auto;
  height: 200px;
  border-radius: 100px;
  position: relative;
  z-index: 1;
  overflow: visible;
}
.videoContainer.desktop {
  border-radius: var(--radius-sm);
  min-width: 280px;
  max-width: 360px;
}
.vid {
  width: 200px;
  height: 200px;
  border-radius: 999px;
  object-fit: cover;
  background: #0f172a;
  border: 4px solid var(--color-mono60);
  display: block;
}
.desktopVid {
  width: 100%;
  min-width: 280px;
  max-width: 360px;
  height: 200px;
  display: block;
  border-radius: var(--radius-sm);
  object-fit: contain;
  background: #0f172a;
  border: 4px solid var(--color-mono60);
}
.sharePlaceholder {
  width: 280px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  color: var(--color-mono30);
  font-size: var(--fs-small);
  border-radius: var(--radius-sm);
}
.local {
  cursor: grab;
  touch-action: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}
.local:active {
  cursor: grabbing;
}
</style>
