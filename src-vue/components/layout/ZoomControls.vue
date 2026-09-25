<script setup lang="ts">
import { useLocalStore } from '@/stores/localStore';
import { applyZoomStep, clampedPanZoom } from '@/constants/panZoom';
import { viewportChrome, visibleViewport } from '@/constants/pan';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const local = useLocalStore();
const ZOOM_STEP = 0.12;

function anchor() {
  const { width, height } = visibleViewport();
  return {
    x: viewportChrome.left + width / 2,
    y: viewportChrome.top + height / 2,
  };
}

function zoomIn() {
  const { x, y } = anchor();
  const next = applyZoomStep(local.pan, local.scale, ZOOM_STEP, x, y);
  local.setPanZoom(clampedPanZoom(next.pan, next.scale, local.roomBounds));
  local.calculateUsersOnScreen();
}

function zoomOut() {
  const { x, y } = anchor();
  const next = applyZoomStep(local.pan, local.scale, -ZOOM_STEP, x, y);
  local.setPanZoom(clampedPanZoom(next.pan, next.scale, local.roomBounds));
  local.calculateUsersOnScreen();
}
</script>

<template>
  <div class="zoomCtl" @pointerdown.stop @click.stop>
    <IconButton label="Zoom in" @click.stop="zoomIn">
      <template #icon><AppIcon name="plus" /></template>
    </IconButton>
    <IconButton label="Zoom out" @click.stop="zoomOut">
      <template #icon><AppIcon name="minus" /></template>
    </IconButton>
  </div>
</template>

<style scoped>
.zoomCtl {
  position: fixed;
  left: 14px;
  bottom: 96px;
  z-index: 6000;
  pointer-events: auto;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  padding: 6px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.18);
}

@media (max-width: 768px) {
  .zoomCtl {
    left: 10px;
    bottom: 148px;
  }
  .zoomCtl :deep(.ibtn) {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
