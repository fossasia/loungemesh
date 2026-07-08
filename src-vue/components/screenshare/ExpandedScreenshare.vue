<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import AppIcon from '../ui/AppIcon.vue';
import ScreenshareVideo from './ScreenshareVideo.vue';

const props = defineProps<{
  id: string;
  name: string;
  track: any;
  index: number;
}>();

const emit = defineEmits<{
  (e: 'minimize'): void;
}>();

const localStore = useLocalStore();
const isLocal = computed(() => props.id === 'local' || props.id === localStore.id);

import { useConferenceStore } from '@/stores/conferenceStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

const conference = useConferenceStore();

/* v8 ignore start */
const hasAudio = computed(() => {
  if (isLocal.value) {
    return !!localStore.screenshareAudio;
  }
  const user = conference.users[props.id];
  return !!user?.screenshareAudio;
});

const isAudioMuted = computed(() => {
  if (isLocal.value) {
    return localStore.screenshareAudioMuted;
  }
  return !!localStore.mutedRemoteScreenshareAudios[props.id];
});

function toggleAudio() {
  const engine = getMediaEngineInstance();
  if (isLocal.value) {
    localStore.screenshareAudioMuted = !localStore.screenshareAudioMuted;
    if (localStore.screenshareAudio) {
      if (localStore.screenshareAudioMuted) {
        localStore.screenshareAudio.mute();
      } else {
        localStore.screenshareAudio.unmute();
      }
    }
  } else {
    const isMuted = !localStore.mutedRemoteScreenshareAudios[props.id];
    localStore.mutedRemoteScreenshareAudios[props.id] = isMuted;
    const user = conference.users[props.id];
    if (user?.screenshareAudio) {
      const trackId = (typeof user.screenshareAudio.getId === 'function')
        ? user.screenshareAudio.getId()
        : (user.screenshareAudio.id || 'mock-track-id');
      engine.setTrackMute?.(trackId, isMuted);
    }
  }
}
/* v8 ignore stop */

const width = ref(480);
const height = computed(() => Math.round((width.value * 9) / 16));
const headerHeight = 37;

const getInitialLeft = () => {
  const initialLeft = 350 + props.index * 20;
  return Math.max(0, Math.min(initialLeft, window.innerWidth - width.value));
};

const getInitialTop = () => {
  const initialTop = 120 + props.index * 20;
  return Math.max(0, Math.min(initialTop, window.innerHeight - height.value - headerHeight));
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

const onDragStart = (e: PointerEvent) => {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.minimizeButton')) return;

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
};

const onDragMove = (e: PointerEvent) => {
  const deltaX = e.clientX - dragStartPointerX;
  const deltaY = e.clientY - dragStartPointerY;

  left.value = Math.max(0, Math.min(dragStartLeft + deltaX, window.innerWidth - width.value));
  top.value = Math.max(0, Math.min(dragStartTop + deltaY, window.innerHeight - height.value - headerHeight));
};

const onDragEnd = (e: PointerEvent) => {
  dragging.value = false;
  const target = e.currentTarget as HTMLElement;
  target.releasePointerCapture(e.pointerId);
  target.removeEventListener('pointermove', onDragMove);
  target.removeEventListener('pointerup', onDragEnd);
  target.removeEventListener('pointercancel', onDragEnd);
};

const onResizeStart = (e: PointerEvent) => {
  if (e.button !== 0) return;
  resizing.value = true;
  resizeStartPointerX = e.clientX;
  resizeStartWidth = width.value;

  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  target.addEventListener('pointermove', onResizeMove);
  target.addEventListener('pointerup', onResizeEnd);
  target.addEventListener('pointercancel', onResizeEnd);
};

const onResizeMove = (e: PointerEvent) => {
  const deltaX = e.clientX - resizeStartPointerX;

  const maxAvailableWidthByRight = window.innerWidth - left.value;
  const maxAvailableHeightByBottom = window.innerHeight - top.value - headerHeight;
  const maxAvailableWidthByBottom = Math.max(0, (maxAvailableHeightByBottom * 16) / 9);

  const maxWidth = Math.min(maxAvailableWidthByRight, maxAvailableWidthByBottom);
  width.value = Math.max(320, Math.min(resizeStartWidth + deltaX, maxWidth));
};

const onResizeEnd = (e: PointerEvent) => {
  resizing.value = false;
  const target = e.currentTarget as HTMLElement;
  target.releasePointerCapture(e.pointerId);
  target.removeEventListener('pointermove', onResizeMove);
  target.removeEventListener('pointerup', onResizeEnd);
  target.removeEventListener('pointercancel', onResizeEnd);
};

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

onMounted(() => {
  left.value = getInitialLeft();
  top.value = getInitialTop();

  window.addEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
});
</script>

<template>
  <div
    class="expandedScreenshareWindow"
    :class="{ 'is-dragging': dragging, 'is-resizing': resizing }"
    :style="{
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
    }"
  >
    <div class="windowHeader" @pointerdown="onDragStart">
      <span class="windowTitle">{{ isLocal ? 'Your Screen' : `${name}'s Screen` }}</span>
      <div class="headerActions">
        <button
          v-if="hasAudio"
          class="audioToggleButton"
          type="button"
          @click.stop="toggleAudio"
          :title="isAudioMuted ? 'Unmute screen audio' : 'Mute screen audio'"
        >
          <AppIcon :name="isAudioMuted ? 'volume-x' : 'volume-2'" :size="16" />
        </button>
        <button
          class="minimizeButton"
          type="button"
          @click="emit('minimize')"
          title="Minimize to Sidebar"
        >
          <AppIcon name="minimize" :size="16" />
        </button>
      </div>
    </div>
    <div class="windowContent" :style="{ height: height + 'px' }">
      <ScreenshareVideo :track="track" />
    </div>
    <div class="resizeHandle" @pointerdown="onResizeStart" title="Resize"></div>
  </div>
</template>

<style scoped>
.expandedScreenshareWindow {
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
  user-select: none;
  animation: expandedPopIn 0.28s cubic-bezier(0.34, 1.4, 0.64, 1) both;
  transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, box-shadow 0.2s;
}

.expandedScreenshareWindow.is-dragging,
.expandedScreenshareWindow.is-resizing {
  transition: none !important;
}

.expandedScreenshareWindow:active {
  box-shadow: 0 20px 60px 0 rgba(31, 38, 135, 0.3);
}

@keyframes expandedPopIn {
  from {
    opacity: 0;
    transform: scale(0.88);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.windowHeader {
  padding: 8px 12px;
  background: rgba(220, 225, 245, 0.5);
  border-bottom: 1px solid var(--line-light);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  cursor: move;
}

.windowTitle {
  font-weight: var(--fw-medium);
  font-family: var(--font-display);
  font-size: var(--fs-small);
  color: var(--color-text-default);
  pointer-events: none;
}

.minimizeButton {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-mono30);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.minimizeButton:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text-default);
}

.windowContent {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resizeHandle {
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
}

.resizeHandle:hover {
  opacity: 1;
}
.headerActions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audioToggleButton {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-mono30);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.audioToggleButton:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text-default);
}
</style>
