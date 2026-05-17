<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import { applyZoomStep, clampedPanZoom, wheelScaleDelta } from '@/constants/panZoom';
import ZoomControls from '@/components/layout/ZoomControls.vue';

const localStore = useLocalStore();
const isPanning = ref(false);
const wrapperRef = ref<HTMLDivElement | null>(null);

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

let startX = 0;
let startY = 0;
let startPanX = 0;
let startPanY = 0;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('button, a, input, textarea, select, .zoomCtl, .ibtn');
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || isInteractiveTarget(e.target)) return;
  isPanning.value = true;
  startX = e.clientX;
  startY = e.clientY;
  startPanX = localStore.pan.x;
  startPanY = localStore.pan.y;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  localStore.setPanZoom({ pan: { x: startPanX + dx, y: startPanY + dy }, scale: localStore.scale });
  localStore.calculateUsersOnScreen();
}

function onPointerUp() {
  isPanning.value = false;
}

function onWheel(e: WheelEvent) {
  if (isInteractiveTarget(e.target)) return;
  e.preventDefault();
  const step = wheelScaleDelta(e);
  const next = applyZoomStep(localStore.pan, localStore.scale, step, e.clientX, e.clientY);
  localStore.setPanZoom(clampedPanZoom(next.pan, next.scale, localStore.roomBounds));
  localStore.calculateUsersOnScreen();
}

onMounted(() => {
  localStore.calculateUsersOnScreen();
});
</script>

<template>
  <ZoomControls class="zoomCorner" />
  <div
    ref="wrapperRef"
    class="panRoot"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
  >
    <div class="panTranslate" :class="{ panning: isPanning }" :style="translateStyle">
      <div class="panScale" :class="{ panning: isPanning }" :style="scaleStyle">
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
  height: 100dvh;
  background-color: var(--color-mono95);
  text-align: left;
}
.panTranslate {
  width: 1px;
  height: 1px;
  display: inline-flex;
  transition: transform 220ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
.panScale {
  width: 1px;
  height: 1px;
  cursor: grab;
  display: inline-flex;
  transition: transform 220ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
.panTranslate.panning,
.panScale.panning {
  transition: none;
}
.panScale:active {
  cursor: grabbing;
}
.zoomCorner {
  position: fixed;
  left: 14px;
  bottom: 96px;
  z-index: 6000;
  pointer-events: auto;
}
</style>
