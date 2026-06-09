<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import StageVideoAttach from '@/components/stage/StageVideoAttach.vue';
import ScreenshareVideo from '@/components/screenshare/ScreenshareVideo.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { getStageOccupantId } from '@/components/stage/getStageOccupantId';
import {
  broadcastStageLayout,
  resetStageLayout,
  stageDisplayName,
} from '@/utils/sessionStage';
import {
  nearestPipCorner,
  pipStyleForLayout,
  scaleFromResizeDelta,
} from '@/utils/stageLayout';
import type { StageLayout, StagePipCorner } from '@/stores/sessionFeaturesStore';

const props = withDefaults(
  defineProps<{
    /** tile: occupant preview in the room; audience: floating view for everyone else */
    mode?: 'tile' | 'audience';
  }>(),
  { mode: 'audience' },
);

const conference = useConferenceStore();
const local = useLocalStore();
const features = useSessionFeaturesStore();
const { engine } = useMediaEngine();

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(640);
const containerHeight = ref(360);
const layoutAnimating = ref(false);
const localViewerExpanded = ref(false);
const localTileExpanded = ref(false);
let layoutThrottle: ReturnType<typeof setTimeout> | undefined;
let resizeObserver: ResizeObserver | undefined;

const occupantId = computed(() =>
  getStageOccupantId(features.stageOccupantId, conference.users),
);

const isLocalOccupant = computed(() => local.id === occupantId.value);
const canEditLayout = computed(() => isLocalOccupant.value);
const isTileMode = computed(() => props.mode === 'tile');

const occupantUser = computed(() => {
  conference.usersEpoch;
  if (!occupantId.value) return null;
  if (occupantId.value === local.id) {
    return {
      id: local.id,
      video: local.video,
      screenshare: local.screenshare,
      videoType: local.videoType,
    };
  }
  const remote = conference.users[occupantId.value];
  return remote
    ? {
        id: occupantId.value,
        video: remote.video,
        screenshare: remote.screenshare,
        videoType: remote.video?.videoType,
      }
    : null;
});

const screenshareTrack = computed(() => occupantUser.value?.screenshare);
const cameraTrack = computed(() => {
  const user = occupantUser.value;
  if (!user?.video) return undefined;
  if (user.videoType === 'desktop') return undefined;
  return user.video;
});

const hasScreenshare = computed(() => !!screenshareTrack.value);
const showPip = computed(() => hasScreenshare.value && !!cameraTrack.value);

const layout = computed(() => features.stageLayout);

const isExpanded = computed(() => {
  if (isTileMode.value) return localTileExpanded.value;
  if (canEditLayout.value) return layout.value.expanded;
  return localViewerExpanded.value;
});

const presentationStyle = computed(() => {
  return undefined;
});

const pipStyle = computed(() =>
  pipStyleForLayout(layout.value, containerWidth.value, containerHeight.value, layoutAnimating.value),
);

const occupantName = computed(() => stageDisplayName(occupantId.value));
const stageLabel = computed(() => {
  if (isTileMode.value) return 'On stage';
  return isLocalOccupant.value ? 'You are on stage' : `${occupantName.value} on stage`;
});

const rootClass = computed(() => ({
  modeTile: isTileMode.value,
  modeAudience: !isTileMode.value,
  expanded: isExpanded.value,
}));

function measureContainer() {
  const el = containerRef.value;
  if (!el) return;
  containerWidth.value = el.clientWidth;
  containerHeight.value = el.clientHeight;
}

function syncLayout(patch: Partial<StageLayout>, animate = true) {
  if (!canEditLayout.value) return;
  layoutAnimating.value = animate;
  broadcastStageLayout(engine, patch);
  if (layoutThrottle) clearTimeout(layoutThrottle);
  layoutThrottle = setTimeout(() => {
    layoutAnimating.value = false;
  }, 220);
}

function throttledLayout(patch: Partial<StageLayout>) {
  if (layoutThrottle) clearTimeout(layoutThrottle);
  layoutThrottle = setTimeout(() => syncLayout(patch, false), 50);
}

function toggleExpanded() {
  if (isTileMode.value) {
    localTileExpanded.value = !localTileExpanded.value;
    return;
  }
  if (canEditLayout.value) {
    syncLayout({ expanded: !layout.value.expanded });
    return;
  }
  localViewerExpanded.value = !localViewerExpanded.value;
}

// Floating window drag & resize logic
const width = ref(480);
const height = computed(() => Math.round((width.value * 9) / 16));
const headerHeight = 40;

const getInitialLeft = () => {
  return Math.max(0, (window.innerWidth - width.value) / 2);
};

const getInitialTop = () => {
  return 72;
};

const left = ref(getInitialLeft());
const top = ref(getInitialTop());

const dragging = ref(false);
const resizing = ref(false);

let dragStartPointerX = 0;
let dragStartPointerY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;

let resizeStartPointerX = 0;
let resizeStartWidth = 0;

function onDragStart(e: PointerEvent) {
  if (isTileMode.value) return;
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('button')) return;

  dragging.value = true;
  dragStartPointerX = e.clientX;
  dragStartPointerY = e.clientY;
  dragStartLeft = left.value;
  dragStartTop = top.value;

  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  target.addEventListener('pointermove', onDragMove);
  target.addEventListener('pointerup', onDragEnd);
  target.addEventListener('pointercancel', onDragEnd);
}

function onDragMove(e: PointerEvent) {
  const deltaX = e.clientX - dragStartPointerX;
  const deltaY = e.clientY - dragStartPointerY;

  left.value = Math.max(0, Math.min(dragStartLeft + deltaX, window.innerWidth - width.value));
  top.value = Math.max(0, Math.min(dragStartTop + deltaY, window.innerHeight - height.value - headerHeight));
}

function onDragEnd(e: PointerEvent) {
  dragging.value = false;
  const target = e.currentTarget as HTMLElement;
  try {
    target.releasePointerCapture(e.pointerId);
  } catch { /* ignore */ }
  target.removeEventListener('pointermove', onDragMove);
  target.removeEventListener('pointerup', onDragEnd);
  target.removeEventListener('pointercancel', onDragEnd);
}

function onResizeStart(e: PointerEvent) {
  if (isTileMode.value) return;
  if (e.button !== 0) return;
  resizing.value = true;
  resizeStartPointerX = e.clientX;
  resizeStartWidth = width.value;

  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  target.addEventListener('pointermove', onResizeMove);
  target.addEventListener('pointerup', onResizeEnd);
  target.addEventListener('pointercancel', onResizeEnd);
}

function onResizeMove(e: PointerEvent) {
  if (!resizing.value) return;
  const deltaX = e.clientX - resizeStartPointerX;

  const maxAvailableWidthByRight = window.innerWidth - left.value;
  const maxAvailableHeightByBottom = window.innerHeight - top.value - headerHeight;
  const maxAvailableWidthByBottom = Math.max(0, (maxAvailableHeightByBottom * 16) / 9);

  const maxWidth = Math.min(maxAvailableWidthByRight, maxAvailableWidthByBottom);
  width.value = Math.max(320, Math.min(resizeStartWidth + deltaX, maxWidth));

  if (canEditLayout.value) {
    const base = layout.value.expanded ? 640 : 480;
    const computedScale = width.value / base;
    throttledLayout({ scale: computedScale });
  }
}

function onResizeEnd(e: PointerEvent) {
  if (!resizing.value) return;
  resizing.value = false;
  const target = e.currentTarget as HTMLElement;
  try {
    target.releasePointerCapture(e.pointerId);
  } catch { /* ignore */ }
  target.removeEventListener('pointermove', onResizeMove);
  target.removeEventListener('pointerup', onResizeEnd);
  target.removeEventListener('pointercancel', onResizeEnd);
}

const clampPosition = () => {
  if (width.value > window.innerWidth) {
    width.value = Math.max(320, window.innerWidth);
  }
  left.value = Math.max(0, Math.min(left.value, window.innerWidth - width.value));
  top.value = Math.max(0, Math.min(top.value, window.innerHeight - height.value - headerHeight));
};

const handleWindowResize = () => {
  clampPosition();
};

function onResetLayout() {
  if (!canEditLayout.value) return;
  resetStageLayout(engine);
  localTileExpanded.value = false;
  width.value = 480;
  left.value = getInitialLeft();
  top.value = getInitialTop();
  layoutAnimating.value = true;
  if (layoutThrottle) clearTimeout(layoutThrottle);
  layoutThrottle = setTimeout(() => {
    layoutAnimating.value = false;
  }, 220);
}

let dragStartX = 0;
let dragStartY = 0;
let dragStartOffset = { x: 0, y: 0 };
let draggingPip = false;

function onPipPointerDown(e: PointerEvent) {
  if (!canEditLayout.value || !showPip.value) return;
  if (e.button !== 0) return;
  draggingPip = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartOffset = { ...layout.value.pipOffset };
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  target.addEventListener('pointermove', onPipPointerMove);
  target.addEventListener('pointerup', onPipPointerUp);
  target.addEventListener('pointercancel', onPipPointerUp);
}

function onPipPointerMove(e: PointerEvent) {
  if (!draggingPip) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  throttledLayout({
    pipOffset: { x: dragStartOffset.x + dx, y: dragStartOffset.y + dy },
  });
}

function onPipPointerUp(e: PointerEvent) {
  if (!draggingPip) return;
  draggingPip = false;
  const target = e.currentTarget as HTMLElement;
  target.releasePointerCapture(e.pointerId);
  target.removeEventListener('pointermove', onPipPointerMove);
  target.removeEventListener('pointerup', onPipPointerUp);
  target.removeEventListener('pointercancel', onPipPointerUp);
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  const pipRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const centerX = pipRect.left + pipRect.width / 2 - rect.left;
  const centerY = pipRect.top + pipRect.height / 2 - rect.top;
  const corner = nearestPipCorner(centerX, centerY, rect.width, rect.height);
  syncLayout({ pipCorner: corner, pipOffset: { x: 0, y: 0 } });
}

function setPipCorner(corner: StagePipCorner) {
  syncLayout({ pipCorner: corner, pipOffset: { x: 0, y: 0 } });
}

const audienceWindowStyle = computed(() => {
  if (isTileMode.value) return undefined;
  return {
    left: left.value + 'px',
    top: top.value + 'px',
    width: width.value + 'px',
  };
});

watch(
  () => [features.stageLayout.scale, features.stageLayout.expanded] as const,
  ([newScale, newExpanded]) => {
    if (isTileMode.value) return;
    if (!resizing.value) {
      const base = newExpanded ? 640 : 480;
      width.value = Math.round(base * newScale);
      clampPosition();
    }
  },
  { immediate: true },
);

watch(isExpanded, (val) => {
  if (isTileMode.value) return;
  if (!resizing.value) {
    const base = val ? 640 : 480;
    width.value = Math.round(base * layout.value.scale);
    clampPosition();
  }
});

watch(
  () => features.stageLayout,
  () => {
    layoutAnimating.value = true;
    if (layoutThrottle) clearTimeout(layoutThrottle);
    layoutThrottle = setTimeout(() => {
      layoutAnimating.value = false;
    }, 220);
  },
  { deep: true },
);

watch(containerRef, (el, _prev, onCleanup) => {
  resizeObserver?.disconnect();
  if (!el) return;
  measureContainer();
  resizeObserver = new ResizeObserver(measureContainer);
  resizeObserver.observe(el);
  onCleanup(() => resizeObserver?.disconnect());
});

onMounted(() => {
  if (!isTileMode.value) {
    left.value = getInitialLeft();
    top.value = getInitialTop();
    window.addEventListener('resize', handleWindowResize);
  }
});

onBeforeUnmount(() => {
  if (!isTileMode.value) {
    window.removeEventListener('resize', handleWindowResize);
  }
  resizeObserver?.disconnect();
  if (layoutThrottle) clearTimeout(layoutThrottle);
});
</script>

<template>
  <div
    class="stagePresentationRoot"
    :class="[rootClass, { 'is-dragging': dragging, 'is-resizing': resizing }]"
    :style="audienceWindowStyle"
    data-testid="stage-presentation"
  >
      <div class="stageToolbar" @pointerdown="onDragStart">
        <span class="stageLabel">{{ stageLabel }}</span>
        <div class="toolbarActions">
          <button type="button" class="toolBtn" title="Expand" @click.stop="toggleExpanded">
            <AppIcon :name="isExpanded ? 'minimize' : 'maximize'" />
          </button>
          <button
            v-if="canEditLayout"
            type="button"
            class="toolBtn resetBtn"
            title="Reset layout"
            @click.stop="onResetLayout"
          >
            Reset
          </button>
        </div>
      </div>

      <div ref="containerRef" class="stageCanvas" :style="presentationStyle">
        <div class="primaryContent">
          <ScreenshareVideo v-if="hasScreenshare" :track="screenshareTrack!" fill />
          <StageVideoAttach
            v-else-if="cameraTrack"
            :track="cameraTrack"
            :mirrored="isLocalOccupant"
            fill
          />
        </div>

        <div
          v-if="showPip"
          class="pipCamera"
          :class="{ draggable: canEditLayout }"
          :style="pipStyle"
          @pointerdown.stop="onPipPointerDown"
        >
          <StageVideoAttach :track="cameraTrack" :mirrored="isLocalOccupant" fill />
        </div>

        <div
          v-if="!isTileMode"
          class="resizeHandle"
          title="Resize presentation"
          @pointerdown.stop="onResizeStart"
        />

        <div v-if="canEditLayout && showPip && !isTileMode" class="cornerPresets">
          <button type="button" class="cornerBtn" title="Top left" @click.stop="setPipCorner('tl')">TL</button>
          <button type="button" class="cornerBtn" title="Top right" @click.stop="setPipCorner('tr')">TR</button>
          <button type="button" class="cornerBtn" title="Bottom left" @click.stop="setPipCorner('bl')">BL</button>
          <button type="button" class="cornerBtn" title="Bottom right" @click.stop="setPipCorner('br')">BR</button>
        </div>
      </div>
  </div>
</template>

<style scoped>
.stagePresentationRoot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
}

.stagePresentationRoot.modeAudience {
  position: fixed;
  z-index: 10040;
  user-select: none;
  transition: left 0.2s ease, top 0.2s ease, width 0.2s ease;
}

.stagePresentationRoot.modeAudience.is-dragging,
.stagePresentationRoot.modeAudience.is-resizing {
  transition: none !important;
}

.modeAudience .stageToolbar {
  cursor: move;
}

.stagePresentationRoot.modeTile {
  position: relative;
  width: 200px;
  z-index: 2;
}

.stagePresentationRoot.modeTile.expanded {
  width: min(320px, 88vw);
}

.stageToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
}

.modeTile .stageToolbar {
  padding: 4px 6px;
}

.stageLabel {
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modeTile .stageLabel {
  font-size: 11px;
}

.toolbarActions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.toolBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-round);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
}

.toolBtn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.resetBtn {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
  font-family: var(--font-body);
}

.stageCanvas {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0f172a;
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
}

.modeTile .stageCanvas {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.primaryContent {
  position: absolute;
  inset: 0;
}

.primaryContent :deep(.screenshareVideo),
.primaryContent :deep(.vid) {
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
  border: none;
  border-radius: 0;
}

.pipCamera {
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  z-index: 2;
  touch-action: none;
}

.pipCamera.draggable {
  cursor: grab;
}

.pipCamera.draggable:active {
  cursor: grabbing;
}

.pipCamera :deep(.vid) {
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
}

.resizeHandle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.65) 50%);
  z-index: 3;
}

.cornerPresets {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  gap: 4px;
  z-index: 3;
}

.cornerBtn {
  border: none;
  border-radius: var(--radius-round);
  padding: 2px 5px;
  font-size: 9px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
}

@media (max-width: 768px) {
  .stagePresentationRoot.modeAudience {
    top: 64px !important;
    left: 10px !important;
    width: calc(100vw - 20px) !important;
  }

  .stagePresentationRoot.modeAudience.expanded {
    width: calc(100vw - 16px) !important;
    left: 8px !important;
  }

  .cornerPresets {
    display: none;
  }
}
</style>
