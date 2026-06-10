<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import ScreenshareVideo from '@/components/screenshare/ScreenshareVideo.vue';
import StageVideoAttach from '@/components/stage/StageVideoAttach.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import { toggleLocalScreenshare } from '@/utils/localScreenshare';
import {
  demoteFromStage,
  goLiveOnStage,
  broadcastStageLayout,
} from '@/utils/sessionStage';
import { nearestPipCorner, pipStyleForLayout, pipSizeForContainer } from '@/utils/stageLayout';
import type { StageLayout, StagePipCorner } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const local = useLocalStore();
const features = useSessionFeaturesStore();
const { engine } = useMediaEngine();

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(480);
const containerHeight = ref(270);

const previewLayout = ref<StageLayout>({
  pipCorner: features.stageLayout.pipCorner,
  pipOffset: { ...features.stageLayout.pipOffset },
  scale: features.stageLayout.scale,
  expanded: features.stageLayout.expanded,
});

const hasScreenshare = computed(() => !!local.screenshare);
const hasCamera = computed(() => !local.cameraOff && !!local.video && local.videoType === 'camera');
const showPip = computed(() => hasScreenshare.value && hasCamera.value);
const hasEverythingShared = computed(() => hasScreenshare.value && hasCamera.value && !local.mute);
const isLocalSpeaking = computed(() => local.speaking && !local.mute);

const tooltipText = computed(() => {
  if (features.isLocalStageOccupant) {
    return 'You are live on stage. Everyone can see and hear you.';
  }
  if (hasEverythingShared.value) {
    return 'You are asked to go on stage. Ready to start?';
  }
  return 'You are asked to go on stage. Please share your screen, camera access, and mic if you like and tap the icon to start.';
});

const pipStyle = computed(() => {
  return pipStyleForLayout(
    previewLayout.value,
    containerWidth.value,
    containerHeight.value,
    false
  );
});

// Dragging support
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffset = { x: 0, y: 0 };
const draggingPip = ref(false);
let broadcastThrottle: ReturnType<typeof setTimeout> | undefined;

function throttledBroadcast(patch: Partial<StageLayout>) {
  if (broadcastThrottle) clearTimeout(broadcastThrottle);
  broadcastThrottle = setTimeout(() => {
    if (features.isLocalStageOccupant) {
      broadcastStageLayout(engine, patch);
    }
  }, 100);
}

function onPipPointerDown(e: PointerEvent) {
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
  
  const layoutUpdate = {
    pipCorner: 'tl' as const,
    pipOffset: { x: rx, y: ry }
  };
  
  // Update local state instantly
  if (features.isLocalStageOccupant) {
    features.stageLayout.pipCorner = 'tl';
    features.stageLayout.pipOffset = { x: rx, y: ry };
    throttledBroadcast(layoutUpdate);
  } else {
    previewLayout.value.pipCorner = 'tl';
    previewLayout.value.pipOffset = { x: rx, y: ry };
  }
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
  
  const layoutUpdate = {
    pipCorner: 'tl' as const,
    pipOffset: { x: rx, y: ry }
  };
  
  if (features.isLocalStageOccupant) {
    features.stageLayout.pipCorner = 'tl';
    features.stageLayout.pipOffset = { x: rx, y: ry };
    broadcastStageLayout(engine, layoutUpdate);
  } else {
    previewLayout.value.pipCorner = 'tl';
    previewLayout.value.pipOffset = { x: rx, y: ry };
  }
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
  
  const layoutUpdate = {
    pipCorner: 'tl' as const,
    pipOffset: { x: rx, y: ry }
  };
  
  if (features.isLocalStageOccupant) {
    features.stageLayout.pipCorner = 'tl';
    features.stageLayout.pipOffset = { x: rx, y: ry };
    broadcastStageLayout(engine, layoutUpdate);
  } else {
    previewLayout.value.pipCorner = 'tl';
    previewLayout.value.pipOffset = { x: rx, y: ry };
  }
}

async function handleScreenshareToggle() {
  await toggleLocalScreenshare(engine);
}

async function handleCameraToggle() {
  await local.toggleCamera();
}

async function handleMicToggle() {
  await local.toggleMute();
}

function handleGoLive() {
  goLiveOnStage(engine, local.id);
  
  // Copy preview settings to layout
  features.stageLayout.pipCorner = previewLayout.value.pipCorner;
  features.stageLayout.pipOffset = { ...previewLayout.value.pipOffset };
  
  // Broadcast pre-configured stage layout scale/pipCorner
  broadcastStageLayout(engine, features.stageLayout);
  emit('close');
}

function handleLeaveStage() {
  demoteFromStage(engine, local.id);
  emit('close');
}

function handleDecline() {
  demoteFromStage(engine, local.id);
  features.stageInvitationPending = false;
  emit('close');
}
</script>

<template>
  <div class="stagePreviewOverlay" @click.self="emit('close')">
    <div class="stagePreviewCard">
      <div class="previewHeader">
        <h3 class="previewTitle">Stage Setup</h3>
        <button type="button" class="closeBtn" @click="emit('close')">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <div class="tooltipBox">
        <AppIcon name="bell" :size="20" class="bellIcon" />
        <span class="tooltipText">{{ tooltipText }}</span>
      </div>

      <div class="statusGrid">
        <div class="statusBadge" :class="{ active: !local.mute }">
          <AppIcon :name="local.mute ? 'mic-off' : 'mic'" :size="14" />
          <span>Mic: {{ !local.mute ? 'Active' : 'Muted' }}</span>
        </div>
        <div class="statusBadge" :class="{ active: hasCamera }">
          <AppIcon :name="hasCamera ? 'video' : 'video-off'" :size="14" />
          <span>Camera: {{ hasCamera ? 'Active' : 'Off' }}</span>
        </div>
        <div class="statusBadge" :class="{ active: hasScreenshare }">
          <AppIcon name="monitor-up" :size="14" />
          <span>Screen: {{ hasScreenshare ? 'Shared' : 'Off' }}</span>
        </div>
      </div>

      <div class="previewContent">
        <!-- 16:9 Canvas Frame -->
        <div ref="containerRef" class="previewCanvas">
          <ScreenshareVideo v-if="hasScreenshare" :track="local.screenshare!" fill />
          <StageVideoAttach v-else-if="hasCamera" :track="local.video!" :mirrored="true" fill />
          <div v-else class="previewPlaceholder">
            <AppIcon name="video-off" :size="48" class="placeholderIcon" />
            <span>No active video source shared</span>
          </div>

          <!-- Draggable PIP camera -->
          <div
            v-if="showPip"
            class="previewPip"
            :class="{ dragging: draggingPip, speaking: isLocalSpeaking }"
            :style="pipStyle"
            @pointerdown.stop="onPipPointerDown"
          >
            <StageVideoAttach :track="local.video!" :mirrored="true" fill />
          </div>
        </div>

        <div v-if="showPip" class="dragNotice">
          <AppIcon name="info" :size="14" />
          <span>Drag your camera avatar to place it anywhere on the screen.</span>
        </div>
      </div>

      <!-- Quick device toggles -->
      <div class="deviceToggles">
        <IconButton
          :label="local.mute ? 'Mic is Muted' : 'Mic is Active'"
          :warning="local.mute"
          class="deviceToggleBtn"
          @click="handleMicToggle"
        >
          <template #icon>
            <AppIcon :name="local.mute ? 'mic-off' : 'mic'" />
          </template>
        </IconButton>
        <IconButton
          :label="local.cameraOff ? 'Camera is Off' : 'Camera is Active'"
          :warning="local.cameraOff"
          class="deviceToggleBtn"
          @click="handleCameraToggle"
        >
          <template #icon>
            <AppIcon :name="local.cameraOff ? 'video-off' : 'video'" />
          </template>
        </IconButton>
        <IconButton
          :label="hasScreenshare ? 'Screenshare Active' : 'Screenshare Off'"
          :active="hasScreenshare"
          class="deviceToggleBtn"
          @click="handleScreenshareToggle"
        >
          <template #icon>
            <AppIcon name="monitor-up" />
          </template>
        </IconButton>
      </div>

      <div class="actionsArea">
        <template v-if="features.isLocalStageOccupant">
          <button type="button" class="actionBtn warn" @click="handleLeaveStage">
            Leave Stage
          </button>
          <button type="button" class="actionBtn secondary" @click="emit('close')">
            Close
          </button>
        </template>
        <template v-else>
          <button type="button" class="actionBtn primary" @click="handleGoLive">
            Go Live
          </button>
          <button type="button" class="actionBtn secondary" @click="handleDecline">
            Decline
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stagePreviewOverlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(12px);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.stagePreviewCard {
  background: #fff;
  border-radius: var(--radius-md);
  width: min(540px, 100%);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line-light);
  animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px) scale(0.95); }
  to { transform: translateY(0) scale(1); }
}

.previewHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line-light);
}

.previewTitle {
  font-size: var(--fs-normal);
  font-weight: var(--fw-bold);
  color: var(--color-text-default);
  margin: 0;
}

.closeBtn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-mono30);
  padding: 4px;
  border-radius: var(--radius-round);
  transition: background 0.15s, color 0.15s;
}

.closeBtn:hover {
  background: var(--btn-default-bg-hover);
  color: var(--color-text-default);
}

.tooltipBox {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 16px 20px 0;
  padding: 12px 16px;
  background: var(--color-mono95);
  border-left: 4px solid var(--color-blue100);
  border-radius: 4px;
}

.bellIcon {
  color: var(--color-blue100);
  animation: pulseBell 2s infinite;
}

@keyframes pulseBell {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.tooltipText {
  font-size: var(--fs-small);
  line-height: 1.5;
  color: var(--color-text-default);
  font-weight: var(--fw-medium);
}

.previewContent {
  padding: 20px;
}

.previewCanvas {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0f172a;
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  border: 1px solid #1e293b;
}

.previewPlaceholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-mono30);
  gap: 12px;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}

.placeholderIcon {
  opacity: 0.6;
}

.previewPip {
  position: absolute;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  cursor: grab;
  z-index: 10;
  background: #0f172a;
  touch-action: none;
  transition: border-color 0.2s ease;
}

.previewPip:active {
  cursor: grabbing;
}

.previewPip :deep(video) {
  border-radius: 50%;
  object-fit: cover;
  width: 100%;
  height: 100%;
}

.previewPip.speaking {
  border-color: var(--color-blue100);
  animation: speakPulse 1.8s ease-in-out infinite;
}

@keyframes speakPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.65); }
  50%       { box-shadow: 0 0 0 14px rgba(79, 110, 247, 0.28); }
}

.previewPip.dragging {
  cursor: grabbing !important;
  transition: none !important;
}

.dragNotice {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: var(--fs-small);
  color: var(--color-mono50);
  font-weight: var(--fw-medium);
}

.deviceToggles {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 10px 20px 20px;
  border-bottom: 1px solid var(--line-light);
}

.deviceToggleBtn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}

.deviceToggleBtn:hover {
  transform: scale(1.05);
}

.actionsArea {
  padding: 16px 20px;
  background: var(--color-mono95);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.actionBtn {
  padding: 10px 20px;
  font-size: var(--fs-small);
  font-weight: var(--fw-semibold);
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.actionBtn:active {
  transform: scale(0.98);
}

.actionBtn.primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
}

.actionBtn.primary:hover {
  background: #3d59e8;
  color: var(--btn-primary-fg);
}

.actionBtn.warn {
  background: var(--btn-warning-bg);
  color: var(--btn-warning-fg);
}

.actionBtn.warn:hover {
  background: var(--btn-warning-bg-hover);
}

.actionBtn.secondary {
  background: var(--btn-default-bg);
  color: var(--color-text-default);
  border: 1px solid var(--line-light);
}

.actionBtn.secondary:hover {
  background: var(--btn-default-bg-hover);
}

.statusGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 16px 20px 0;
}

.statusBadge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: var(--fw-bold);
  border: 1px solid var(--line-light);
  background: var(--color-mono95);
  color: var(--color-mono30);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.statusBadge.active {
  background: rgba(16, 185, 129, 0.1);
  color: rgb(16, 185, 129);
  border-color: rgba(16, 185, 129, 0.3);
}

.statusBadge:not(.active) {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  border-color: rgba(239, 68, 68, 0.3);
}
</style>
