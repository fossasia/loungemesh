<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { worldToRoom } from '@/constants/pan';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import UserBackdrop from './overlays/UserBackdrop.vue';
import LocalAudioRing from './overlays/LocalAudioRing.vue';
import LocalNameContainer from './LocalNameContainer.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';

const props = withDefaults(
  defineProps<{
    draggable?: boolean;
  }>(),
  { draggable: true },
);

const local = useLocalStore();
const features = useSessionFeaturesStore();
const videoEl = ref<HTMLVideoElement | null>(null);
const audioEl = ref<HTMLAudioElement | null>(null);
const dragSurface = ref<HTMLElement | null>(null);

let dragging = false;
let clickDelta = { x: 0, y: 0 };

const style = computed(() => {
  const display = worldToRoom(local.pos, local.roomBounds);
  return {
    position: 'absolute' as const,
    width: '200px',
    left: `${display.x}px`,
    top: `${display.y}px`,
  };
});

const userId = computed(() => local.id || 'localUser');
const isDesktop = computed(() => local.videoType === 'desktop');
const hasVideo = computed(() => !!local.video);
const showCameraVideo = computed(() => hasVideo.value && !local.cameraOff);
const reaction = computed(() => (local.id ? features.userReactions[local.id]?.emoji : undefined));
const handUp = computed(() => features.handRaised);

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
  () => [local.video, local.videoType, local.cameraOff, showCameraVideo.value],
  async () => {
    await nextTick();
    attach();
  },
);

function onPointerDown(e: PointerEvent) {
  if (!props.draggable || e.button !== 0) return;
  e.stopPropagation();
  const el = dragSurface.value;
  if (!el) return;
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
  const xPos = (e.clientX - pan.x) / scale - clickDelta.x;
  const yPos = (e.clientY - pan.y) / scale - clickDelta.y;
  local.setLocalPosition({ x: xPos, y: yPos });
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  const el = dragSurface.value;
  if (!el) return;
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
  >
    <div
      ref="dragSurface"
      class="dragSurface"
      :class="{ desktop: isDesktop }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <LocalAudioRing />
      <div class="videoContainer" :class="{ desktop: isDesktop }">
        <UserBackdrop :onStage="local.onStage" />
        <MuteIndicator v-if="local.mute" clickable @click="local.toggleMute()" />
        <video
          v-show="showCameraVideo"
          ref="videoEl"
          autoplay
          playsinline
          muted
          :class="[
            isDesktop ? 'desktopVid' : 'vid',
            { speaking: local.speaking && !local.mute && showCameraVideo },
          ]"
        />
        <div v-if="isDesktop && !hasVideo" class="sharePlaceholder">Starting screen share…</div>
      </div>
      <audio ref="audioEl" autoplay muted />
      <span v-if="reaction" class="floatReact">{{ reaction }}</span>
    </div>
    <LocalNameContainer class="nameEditArea" :hand-up="handUp" />
  </div>
</template>

<style scoped>
.dragSurface {
  position: relative;
  cursor: grab;
  touch-action: none;
}
.dragSurface:active {
  cursor: grabbing;
}
.nameEditArea {
  position: relative;
  z-index: 4;
  width: 100%;
  max-width: 200px;
  pointer-events: auto;
}
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
  position: relative;
  z-index: 1;
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
.vid.speaking,
.desktopVid.speaking {
  border-color: var(--color-blue100);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.28);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}
.floatReact {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 1.5rem;
  z-index: 5;
  pointer-events: none;
}
</style>
