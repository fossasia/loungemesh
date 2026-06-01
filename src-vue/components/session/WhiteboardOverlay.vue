<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { whiteboardChrome } from '@/constants/pan';
import { useWhiteboard } from '@/composables/useWhiteboard';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps<{
  onClose: () => void;
}>();

const features = useSessionFeaturesStore();
const surfaceRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const canDraw = computed(() => features.canUseWhiteboard);
const { bindCanvas, onCanvasDown, onCanvasMove, onCanvasUp, clearWhiteboard } = useWhiteboard(
  () => features.panel === 'whiteboard',
  () => canDraw.value,
);

watch(canvasRef, (el) => bindCanvas(el), { immediate: true });
</script>

<template>
  <div
    class="wbOverlay"
    :style="{
      top: `${whiteboardChrome.top}px`,
      right: `${whiteboardChrome.right}px`,
      bottom: `${whiteboardChrome.bottom}px`,
      left: `${whiteboardChrome.left}px`,
    }"
    @pointerdown.stop
    @wheel.stop
  >
    <div class="wbChrome">
      <span class="wbTitle">Whiteboard</span>
      <IconButton label="Close whiteboard" ghost @click="onClose">
        <template #icon><AppIcon name="close" /></template>
      </IconButton>
    </div>
    <div ref="surfaceRef" class="wbSurface">
      <button
        v-if="features.canClearWhiteboard"
        type="button"
        class="wbClear"
        @click="clearWhiteboard"
      >
        Clear
      </button>
      <canvas
        ref="canvasRef"
        class="wbCanvas"
        :class="{ readonly: !canDraw }"
        aria-label="Collaborative whiteboard"
        @pointerdown="onCanvasDown"
        @pointermove="onCanvasMove"
        @pointerup="onCanvasUp"
        @pointercancel="onCanvasUp"
      />
    </div>
  </div>
</template>

<style scoped>
.wbOverlay {
  position: fixed;
  z-index: 4500;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  box-sizing: border-box;
  pointer-events: auto;
}
.wbChrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 0 4px;
}
.wbTitle {
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
}
.wbSurface {
  flex: 1;
  min-height: 0;
  position: relative;
  background: #fff;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.wbClear {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  border: none;
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--color-text-default);
  font-family: var(--font-body);
  font-weight: var(--fw-medium);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.wbClear:hover {
  background: var(--btn-default-bg-hover);
}
.wbCanvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}
.wbCanvas.readonly {
  cursor: default;
  pointer-events: none;
}
</style>
