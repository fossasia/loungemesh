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
  pipSizeForContainer,
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
  pipStyleForLayout(layout.value, containerWidth.value, containerHeight.value, layoutAnimating.value && !draggingPip.value),
);

const occupantName = computed(() => stageDisplayName(occupantId.value));
const isOccupantSpeaking = computed(() => {
  if (!occupantId.value) return false;
  if (occupantId.value === local.id) {
    return local.speaking && !local.mute;
  }
  const remote = conference.users[occupantId.value];
  return !!remote?.speaking && !remote?.mute;
});
const stageLabel = computed(() => {
  if (isTileMode.value) return 'On stage';
  return isLocalOccupant.value ? 'On stage: You' : `On stage: ${occupantName.value}`;
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
}

let dragStartX = 0;
let dragStartY = 0;
let dragStartOffset = { x: 0, y: 0 };
const draggingPip = ref(false);
let broadcastThrottle: ReturnType<typeof setTimeout> | undefined;

function throttledBroadcast(patch: Partial<StageLayout>) {
  if (broadcastThrottle) clearTimeout(broadcastThrottle);
  broadcastThrottle = setTimeout(() => {
    if (canEditLayout.value) {
      broadcastStageLayout(engine, patch);
    }
  }, 100);
}

function onPipPointerDown(e: PointerEvent) {
  if (!canEditLayout.value || !showPip.value) return;
  if (e.button !== 0) return;
  draggingPip.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  const pipRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  
  const curLeft = pipRect.left - rect.left;
  const curTop = pipRect.top - rect.top;
  dragStartOffset = { x: curLeft, y: curTop };
  
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  target.addEventListener('pointermove', onPipPointerMove);
  target.addEventListener('pointerup', onPipPointerUp);
  target.addEventListener('pointercancel', onPipPointerUp);
}

function onPipPointerMove(e: PointerEvent) {
  if (!draggingPip.value) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  
  const newLeft = dragStartOffset.x + dx;
  const newTop = dragStartOffset.y + dy;
  
  const size = pipSizeForContainer(containerWidth.value);
  const padding = 8;
  const usableWidth = containerWidth.value - size - padding * 2;
  const usableHeight = containerHeight.value - size - padding * 2;
  
  const rx = usableWidth > 0 ? Math.max(0, Math.min(1, (newLeft - padding) / usableWidth)) : 0;
  const ry = usableHeight > 0 ? Math.max(0, Math.min(1, (newTop - padding) / usableHeight)) : 0;
  
  // Update local store state immediately!
  features.stageLayout.pipCorner = 'tl';
  features.stageLayout.pipOffset = { x: rx, y: ry };
  
  // Throttled network updates
  throttledBroadcast({
    pipCorner: 'tl',
    pipOffset: { x: rx, y: ry },
  });
}

function onPipPointerUp(e: PointerEvent) {
  if (!draggingPip.value) return;
  draggingPip.value = false;
  const target = e.currentTarget as HTMLElement;
  try {
    target.releasePointerCapture(e.pointerId);
  } catch { /* ignore */ }
  target.removeEventListener('pointermove', onPipPointerMove);
  target.removeEventListener('pointerup', onPipPointerUp);
  target.removeEventListener('pointercancel', onPipPointerUp);
  
  if (broadcastThrottle) {
    clearTimeout(broadcastThrottle);
    broadcastThrottle = undefined;
  }
  
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  const pipRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  
  const newLeft = pipRect.left - rect.left;
  const newTop = pipRect.top - rect.top;
  
  const size = pipSizeForContainer(containerWidth.value);
  const padding = 8;
  const usableWidth = containerWidth.value - size - padding * 2;
  const usableHeight = containerHeight.value - size - padding * 2;
  
  const rx = usableWidth > 0 ? Math.max(0, Math.min(1, (newLeft - padding) / usableWidth)) : 0;
  const ry = usableHeight > 0 ? Math.max(0, Math.min(1, (newTop - padding) / usableHeight)) : 0;
  
  syncLayout({
    pipCorner: 'tl',
    pipOffset: { x: rx, y: ry },
  });
}

function setPipCorner(corner: StagePipCorner) {
  let rx = 0;
  let ry = 0;
  if (corner === 'tr') {
    rx = 1; ry = 0;
  } else if (corner === 'bl') {
    rx = 0; ry = 1;
  } else if (corner === 'br') {
    rx = 1; ry = 1;
  }
  syncLayout({ pipCorner: 'tl', pipOffset: { x: rx, y: ry } });
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
        <div class="stageHeaderLeft">
          <span class="stageLabel">{{ stageLabel }}</span>
          <span v-if="canEditLayout && showPip" class="dragNotice">Drag avatar to reposition</span>
        </div>
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

      <div class="stageContent">
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
            :class="{ draggable: canEditLayout, dragging: draggingPip, speaking: isOccupantSpeaking }"
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

.stagePresentationRoot.modeAudience:not(.expanded) {
  position: fixed !important;
  left: 32px !important;
  top: 104px !important;
  width: 300px !important;
  max-height: calc(100vh - 200px) !important;
  z-index: 4000 !important;
  background: rgba(245, 247, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  user-select: none;
}

.stagePresentationRoot.modeAudience.expanded {
  position: fixed;
  z-index: 4100; /* above the sidebar (4000) */
  background: rgba(245, 247, 255, 0.9);
  backdrop-filter: blur(16px);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, box-shadow 0.2s;
  user-select: none;
}

.stagePresentationRoot.modeAudience.expanded.is-dragging,
.stagePresentationRoot.modeAudience.expanded.is-resizing {
  transition: none !important;
}

.stagePresentationRoot.modeAudience:active {
  box-shadow: 0 20px 60px 0 rgba(31, 38, 135, 0.3);
}

.stageHeaderLeft {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.modeAudience:not(.expanded) .stageToolbar {
  padding: 12px 16px;
  background: transparent;
  color: var(--color-text-default);
  border-bottom: 1px solid var(--line-light);
  cursor: default;
}

.modeAudience.expanded .stageToolbar {
  padding: 8px 12px;
  background: rgba(220, 225, 245, 0.5);
  border-bottom: 1px solid var(--line-light);
  cursor: move;
  color: var(--color-text-default);
}

.modeAudience .stageLabel {
  font-weight: var(--fw-medium);
  font-family: var(--font-display);
  font-size: var(--fs-body);
  color: var(--color-text-default);
}

.modeAudience.expanded .stageLabel {
  font-size: var(--fs-small);
}

.modeAudience:not(.expanded) .stageContent {
  padding: 12px;
}

.modeAudience.expanded .stageContent {
  padding: 0;
  flex: 1;
}

.modeAudience .toolBtn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-mono30);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
  width: auto;
  height: auto;
}

.modeAudience .toolBtn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text-default);
}

.modeAudience .resetBtn {
  padding: 4px 8px;
  font-size: 11px;
  font-family: var(--font-body);
}

.dragNotice {
  font-size: 11px;
  color: var(--color-text-light);
}

.modeAudience:not(.expanded) .resizeHandle {
  display: none;
}

.modeAudience.expanded .resizeHandle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, var(--color-blue100) 50%);
  opacity: 0.5;
  transition: opacity 0.2s;
  z-index: 10;
  display: block;
}

.modeAudience.expanded .resizeHandle:hover {
  opacity: 1;
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
  transition: border-color 0.2s ease;
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
  border-radius: 50%;
}

.pipCamera.speaking {
  border-color: var(--color-blue100);
  animation: speakPulse 1.8s ease-in-out infinite;
}

@keyframes speakPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.65); }
  50%       { box-shadow: 0 0 0 14px rgba(79, 110, 247, 0.28); }
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

.pipCamera.dragging {
  cursor: grabbing !important;
  transition: none !important;
}

.dragNotice {
  font-size: 11px;
  color: var(--color-mono50);
  margin-right: 8px;
  align-self: center;
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
}
</style>
