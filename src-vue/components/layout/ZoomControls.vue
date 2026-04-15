<script setup lang="ts">
import { useLocalStore } from '@/stores/localStore';
import { applyZoomStep, clampedPanZoom } from '@/constants/panZoom';
import { visibleViewport } from '@/constants/pan';
import IconButton from '@/components/ui/IconButton.vue';

const local = useLocalStore();
const ZOOM_STEP = 0.12;

function anchor() {
  const { width, height } = visibleViewport();
  return {
    x: width / 2 + 16,
    y: height / 2 + 16,
  };
}

function zoomIn() {
  const { x, y } = anchor();
  const next = applyZoomStep(local.pan, local.scale, ZOOM_STEP, x, y);
  local.setPanZoom(clampedPanZoom(next.pan, next.scale));
  local.calculateUsersOnScreen();
}

function zoomOut() {
  const { x, y } = anchor();
  const next = applyZoomStep(local.pan, local.scale, -ZOOM_STEP, x, y);
  local.setPanZoom(clampedPanZoom(next.pan, next.scale));
  local.calculateUsersOnScreen();
}
</script>

<template>
  <div class="zoomCtl">
    <IconButton label="Zoom in" ghost @click="zoomIn">
      <template #icon><span class="glyph">+</span></template>
    </IconButton>
    <IconButton label="Zoom out" ghost @click="zoomOut">
      <template #icon><span class="glyph">−</span></template>
    </IconButton>
  </div>
</template>

<style scoped>
.zoomCtl {
  display: inline-flex;
  flex-direction: row;
  gap: 6px;
  align-items: center;
}
.glyph {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1;
}
</style>
