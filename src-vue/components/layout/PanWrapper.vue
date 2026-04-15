<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import { applyZoomStep, clampedPanZoom } from '@/constants/panZoom';

const localStore = useLocalStore();
const wrapperRef = ref<HTMLDivElement | null>(null);

// Keep pan in screen pixels and scale separately (matches expected UX math).
const translateStyle = computed(() => {
  const { pan } = localStore;
  return {
    transform: `translate(${pan.x}px, ${pan.y}px)`,
    transformOrigin: '0 0',
  };
});

const scaleStyle = computed(() => {
  const { scale } = localStore;
  return {
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
  };
});

let isPanning = false;
let startX = 0;
let startY = 0;
let startPanX = 0;
let startPanY = 0;

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  isPanning = true;
  startX = e.clientX;
  startY = e.clientY;
  startPanX = localStore.pan.x;
  startPanY = localStore.pan.y;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  // Pan is stored in screen pixels.
  localStore.setPanZoom({ pan: { x: startPanX + dx, y: startPanY + dy }, scale: localStore.scale });
  localStore.calculateUsersOnScreen();
}

function onPointerUp() {
  isPanning = false;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = -e.deltaY;
  const step = delta > 0 ? 0.1 : -0.1;
  const next = applyZoomStep(localStore.pan, localStore.scale, step, e.clientX, e.clientY);
  localStore.setPanZoom(clampedPanZoom(next.pan, next.scale));
  localStore.calculateUsersOnScreen();
}

onMounted(() => {
  localStore.calculateUsersOnScreen();
});
</script>

<template>
  <div
    ref="wrapperRef"
    class="panRoot"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
  >
    <div class="panTranslate" :style="translateStyle">
      <div class="panScale" :style="scaleStyle">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.panRoot {
  position: fixed;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  width: 100vw;
  height: 100vh;
  /* Same tone as room canvas — matches production spatial “light field” */
  background-color: var(--color-mono95);
}
.panInner {
  width: 1px;
  height: 1px;
  cursor: grab;
  display: inline-flex;
}
.panTranslate {
  width: 1px;
  height: 1px;
  display: inline-flex;
}
.panScale {
  width: 1px;
  height: 1px;
  cursor: grab;
  display: inline-flex;
}
.panScale:active {
  cursor: grabbing;
}
</style>

