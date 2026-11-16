import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { whiteboardMaxScale } from '@/constants/pan';
import {
  clampWhiteboardOffset,
  scaleFromResizeDelta,
  whiteboardOverlayBox,
  type WhiteboardOffset,
} from '@/utils/whiteboardLayout';

/** Size and position the whiteboard panel within chrome bounds. */
export function useWhiteboardLayout(shellRef: Ref<HTMLElement | null>) {
  const scale = ref(1);
  const offset = ref<WhiteboardOffset>({ x: 0, y: 0 });
  const parentSize = ref({ width: 0, height: 0 });

  let resizing = false;
  let dragging = false;
  let startScale = 1;
  let startOffset: WhiteboardOffset = { x: 0, y: 0 };
  let startX = 0;
  let startY = 0;
  let resizeObserver: ResizeObserver | undefined;

  const canDrag = computed(() => scale.value < whiteboardMaxScale - 1e-6);

  function measureShell() {
    const el = shellRef.value;
    if (!el) return;
    parentSize.value = {
      width: Math.max(0, el.clientWidth),
      height: Math.max(0, el.clientHeight),
    };
    syncOffset();
  }

  function syncOffset() {
    const { width, height } = parentSize.value;
    if (scale.value >= whiteboardMaxScale) {
      offset.value = { x: 0, y: 0 };
      return;
    }
    offset.value = clampWhiteboardOffset(offset.value, width, height, scale.value);
  }

  const overlayStyle = computed(() => {
    const { width, height } = parentSize.value;
    return whiteboardOverlayBox(width, height, scale.value, offset.value);
  });

  function onResizeDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    measureShell();
    resizing = true;
    startScale = scale.value;
    startX = e.clientX;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizing) return;
    e.stopPropagation();
    const { width, height } = parentSize.value;
    scale.value = scaleFromResizeDelta(
      startScale,
      e.clientX - startX,
      e.clientY - startY,
      width,
      height,
    );
    syncOffset();
  }

  function endResize(e: PointerEvent) {
    if (!resizing) return;
    resizing = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onDragDown(e: PointerEvent) {
    if (e.button !== 0 || !canDrag.value) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target?.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    measureShell();
    dragging = true;
    startOffset = { ...offset.value };
    startX = e.clientX;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging) return;
    e.stopPropagation();
    const { width, height } = parentSize.value;
    offset.value = clampWhiteboardOffset(
      {
        x: startOffset.x + (e.clientX - startX),
        y: startOffset.y + (e.clientY - startY),
      },
      width,
      height,
      scale.value,
    );
  }

  function endDrag(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  watch(scale, () => syncOffset());

  onMounted(() => {
    measureShell();
    const el = shellRef.value;
    if (!el) return;
    resizeObserver = new ResizeObserver(() => measureShell());
    resizeObserver.observe(el);
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
  });

  return {
    scale,
    offset,
    canDrag,
    overlayStyle,
    onResizeDown,
    onResizeMove,
    onResizeUp: endResize,
    onResizeCancel: endResize,
    onDragDown,
    onDragMove,
    onDragUp: endDrag,
    onDragCancel: endDrag,
  };
}
