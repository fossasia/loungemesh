import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { WHITEBOARD_DEFAULT_PEN } from '@/constants/whiteboardPens';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import type { WhiteboardStroke } from '@/utils/whiteboardSync';
import {
  clientToCanvasPoint,
  ensureWhiteboardCanvasSize,
  renderWhiteboard,
} from '@/utils/whiteboardCanvas';

/** Collaborative whiteboard drawing synced via conference commands. */
export function useWhiteboard(active: () => boolean, canDraw: () => boolean) {
  const features = useSessionFeaturesStore();
  const { engine } = useMediaEngine();
  const canvasEl = ref<HTMLCanvasElement | null>(null);
  const penColor = ref(WHITEBOARD_DEFAULT_PEN.color);
  const penWidth = ref(WHITEBOARD_DEFAULT_PEN.width);
  let drawing = false;
  let currentStroke: WhiteboardStroke | null = null;
  let resizeObserver: ResizeObserver | undefined;

  function resizeCanvas() {
    const canvas = canvasEl.value;
    if (!canvas) return;
    ensureWhiteboardCanvasSize(canvas);
    redrawWhiteboard();
  }

  function redrawWhiteboard() {
    renderWhiteboard(canvasEl.value, features.whiteboardStrokes, currentStroke);
  }

  function publishStroke(stroke: WhiteboardStroke, isLocal = false) {
    features.addWhiteboardStroke(stroke, isLocal);
    engine.sendCommand('wb', JSON.stringify({ action: 'stroke', stroke }));
  }

  function onCanvasDown(e: PointerEvent) {
    e.stopPropagation();
    if (!canDraw()) return;
    const point = clientToCanvasPoint(canvasEl.value, e.clientX, e.clientY);
    if (!point) return;
    drawing = true;
    currentStroke = {
      id: `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color: penColor.value,
      width: penWidth.value,
      points: [point],
    };
    canvasEl.value?.setPointerCapture(e.pointerId);
    redrawWhiteboard();
  }

  function onCanvasMove(e: PointerEvent) {
    e.stopPropagation();
    if (!drawing || !currentStroke) return;
    const point = clientToCanvasPoint(canvasEl.value, e.clientX, e.clientY);
    if (!point) return;
    currentStroke.points.push(point);
    redrawWhiteboard();
  }

  function onCanvasUp(e: PointerEvent) {
    e.stopPropagation();
    if (!drawing || !currentStroke) return;
    drawing = false;
    try {
      canvasEl.value?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (currentStroke.points.length > 1) {
      publishStroke(currentStroke, true);
    }
    currentStroke = null;
    redrawWhiteboard();
  }

  function clearWhiteboard() {
    if (!features.canClearWhiteboard) return;
    features.clearWhiteboard(true);
    engine.sendCommand('wb', JSON.stringify({ action: 'clear' }));
    redrawWhiteboard();
  }

  function bindCanvas(el: HTMLCanvasElement | null) {
    canvasEl.value = el;
    resizeObserver?.disconnect();
    if (!el?.parentElement) return;
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(el.parentElement);
    resizeCanvas();
  }

  watch(
    () => [features.whiteboardStrokes, active()],
    async () => {
      if (!active()) return;
      await nextTick();
      resizeCanvas();
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
  });

  return {
    canvasEl,
    penColor,
    penWidth,
    bindCanvas,
    onCanvasDown,
    onCanvasMove,
    onCanvasUp,
    clearWhiteboard,
    redrawWhiteboard,
  };
}
