<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { whiteboardChrome } from '@/constants/pan';
import { useWhiteboard } from '@/composables/useWhiteboard';
import { useWhiteboardLayout } from '@/composables/useWhiteboardLayout';
import WhiteboardPenToolbar from '@/components/session/WhiteboardPenToolbar.vue';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps<{
  onClose: () => void;
}>();

const features = useSessionFeaturesStore();
const shellRef = ref<HTMLElement | null>(null);
const surfaceRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const canDraw = computed(() => features.canUseWhiteboard);
const {
  bindCanvas,
  penColor,
  penWidth,
  onCanvasDown,
  onCanvasMove,
  onCanvasUp,
  clearWhiteboard,
} = useWhiteboard(() => features.panel === 'whiteboard', () => canDraw.value);
const {
  canDrag,
  overlayStyle,
  onResizeDown,
  onResizeMove,
  onResizeUp,
  onResizeCancel,
  onDragDown,
  onDragMove,
  onDragUp,
  onDragCancel,
} = useWhiteboardLayout(shellRef);

const shellStyle = computed(() => ({
  top: `${whiteboardChrome.top}px`,
  right: `${whiteboardChrome.right}px`,
  bottom: `${whiteboardChrome.bottom}px`,
  left: `${whiteboardChrome.left}px`,
}));

watch(canvasRef, (el) => bindCanvas(el), { immediate: true });
</script>

<template>
  <div ref="shellRef" class="wbShell" :style="shellStyle" @wheel.stop>
    <div class="wbOverlay" :style="overlayStyle" @pointerdown.stop>
      <div
        class="wbChrome"
        :class="{ draggable: canDrag }"
        @pointerdown="onDragDown"
        @pointermove="onDragMove"
        @pointerup="onDragUp"
        @pointercancel="onDragCancel"
      >
        <span class="wbTitle">Whiteboard</span>
        <IconButton label="Close whiteboard" ghost @click="onClose">
          <template #icon><AppIcon name="close" /></template>
        </IconButton>
      </div>
      <div ref="surfaceRef" class="wbSurface">
        <WhiteboardPenToolbar
          v-if="canDraw"
          v-model:pen-color="penColor"
          v-model:pen-width="penWidth"
        />
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
      <div
        class="wbResize"
        role="separator"
        :aria-orientation="'both' as any"
        aria-label="Resize whiteboard"
        title="Drag to resize"
        @pointerdown="onResizeDown"
        @pointermove="onResizeMove"
        @pointerup="onResizeUp"
        @pointercancel="onResizeCancel"
      />
    </div>
  </div>
</template>

<style scoped>
.wbShell {
  position: fixed;
  z-index: 4500;
  box-sizing: border-box;
  pointer-events: none;
}
.wbOverlay {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
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
  touch-action: none;
}
.wbChrome.draggable {
  cursor: grab;
}
.wbChrome.draggable:active {
  cursor: grabbing;
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
.wbResize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 24px;
  cursor: nwse-resize;
  touch-action: none;
  z-index: 3;
  border-bottom-right-radius: var(--radius-sm);
  background: linear-gradient(
    135deg,
    transparent 0 42%,
    rgba(0, 0, 0, 0.06) 42% 100%
  );
}
.wbResize::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 12px;
  height: 12px;
  opacity: 0.75;
  background: repeating-linear-gradient(
    -45deg,
    var(--color-mono50),
    var(--color-mono50) 1px,
    transparent 1px,
    transparent 4px
  );
}
.wbResize:hover::after {
  opacity: 1;
}
</style>
