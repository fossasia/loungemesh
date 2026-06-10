<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { worldToRoom } from '@/constants/pan';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import UserBackdrop from './overlays/UserBackdrop.vue';
import LocalAudioRing from './overlays/LocalAudioRing.vue';
import LocalNameContainer from './LocalNameContainer.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';
import {
  mediaDebug,
  mediaDebugVideoAfterAttach,
  mediaDebugVideoElement,
} from '@/utils/mediaDebug';
import { clearMediaElement } from '@/utils/clearMediaElement';

const props = withDefaults(
  defineProps<{
    draggable?: boolean;
  }>(),
  { draggable: true },
);

const local = useLocalStore();
const conference = useConferenceStore();
const features = useSessionFeaturesStore();
const videoEl = ref<HTMLVideoElement | null>(null);
const audioEl = ref<HTMLAudioElement | null>(null);
const dragSurface = ref<HTMLElement | null>(null);

const dragging = ref(false);
let clickDelta = { x: 0, y: 0 };
let attachedVideoTrack: typeof local.video;

const style = computed(() => {
  const display = worldToRoom(local.pos, local.roomBounds);
  return {
    position: 'absolute' as const,
    width: '200px',
    left: `${display.x}px`,
    top: `${display.y}px`,
  };
});

const userId = computed(() => local.id || 'localUser');
const hasVideo = computed(() => !!local.video);
const showCameraVideo = computed(() => hasVideo.value && !local.cameraOff);
const showAvatar = computed(() => !showCameraVideo.value || isStageOccupant.value);
const reaction = computed(() => (local.id ? features.userReactions[local.id]?.emoji : undefined));
const handUp = computed(() => features.handRaised);
const isStageOccupant = computed(() => features.isLocalStageOccupant);

function releaseVideoPreview() {
  if (attachedVideoTrack && videoEl.value) {
    try {
      attachedVideoTrack.detach?.(videoEl.value);
    } catch {
      /* ignore */
    }
  }
  attachedVideoTrack = undefined;
  clearMediaElement(videoEl.value, { stopTracks: true });
}

function attach() {
  if (attachedVideoTrack && attachedVideoTrack !== local.video && videoEl.value) {
    try {
      attachedVideoTrack.detach?.(videoEl.value);
    } catch {
      /* ignore */
    }
    attachedVideoTrack = undefined;
  }
  if (!showCameraVideo.value) {
    releaseVideoPreview();
  } else if (local.video && videoEl.value) {
    mediaDebugVideoElement('LocalUser', 'attach:before', local.id || 'local', videoEl.value, {
      cameraOff: local.cameraOff,
      trackMuted: local.video.isMuted?.(),
    });
    try {
      local.video.attach?.(videoEl.value);
      attachedVideoTrack = local.video;
      mediaDebugVideoElement('LocalUser', 'attach:after', local.id || 'local', videoEl.value);
      mediaDebugVideoAfterAttach('LocalUser', local.id || 'local', videoEl.value);
      // Explicit play() for Firefox autoplay policy compliance
      if (videoEl.value.paused) {
        videoEl.value.play().catch(() => { /* blocked — will play on gesture */ });
      }
    } catch (err) {
      mediaDebug('LocalUser', 'attach:failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (local.audio && audioEl.value) {
    local.audio.attach?.(audioEl.value);
  } else {
    clearMediaElement(audioEl.value);
  }
}

function detach() {
  releaseVideoPreview();
  if (local.audio && audioEl.value) local.audio.detach?.(audioEl.value);
  clearMediaElement(audioEl.value);
}

watch(
  () => [local.video, local.cameraOff, showCameraVideo.value],
  async () => {
    await nextTick();
    attach();
  },
  { flush: 'sync' },
);

function onPointerDown(e: PointerEvent) {
  if (!props.draggable || e.button !== 0) return;
  e.stopPropagation();
  const el = dragSurface.value;
  if (!el) return;
  dragging.value = true;
  const rect = el.getBoundingClientRect();
  const scale = local.scale || 1;
  clickDelta = {
    x: (e.clientX - rect.left) / scale,
    y: (e.clientY - rect.top) / scale,
  };
  el.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  const scale = local.scale || 1;
  const pan = local.pan;
  const xPos = (e.clientX - pan.x) / scale - clickDelta.x;
  const yPos = (e.clientY - pan.y) / scale - clickDelta.y;
  local.setLocalPosition({ x: xPos, y: yPos });
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  const el = dragSurface.value;
  if (!el) return;
  try {
    el.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
}

onMounted(attach);
onBeforeUnmount(detach);

defineExpose({ attach, videoEl });
</script>

<template>
  <div
    :id="userId"
    class="local userContainer"
    :class="{ 'is-dragging': dragging }"
    :data-recording-participant="userId"
    :data-recording-name="conference.displayName"
    :style="style"
  >
    <div
      ref="dragSurface"
      class="dragSurface"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <LocalAudioRing />
      <div
        class="videoContainer"
        :class="{
          avatarTile: showAvatar,
          speaking: local.speaking && !local.mute && showAvatar,
          onStageOccupant: isStageOccupant,
        }"
      >
        <UserBackdrop v-if="showAvatar" :onStage="isStageOccupant" />
        <MuteIndicator v-if="local.mute" clickable @click="local.toggleMute()" />
        <div v-if="handUp" class="handBadge" title="Hand raised">✋</div>
        <span v-if="reaction" class="floatReact">{{ reaction }}</span>
        <video
          v-if="!showAvatar"
          ref="videoEl"
          autoplay
          playsinline
          muted
          disablePictureInPicture
          :class="[
            'vid',
            { speaking: local.speaking && !local.mute && !showAvatar },
          ]"
        />
      </div>
      <audio ref="audioEl" autoplay muted />
    </div>
    <LocalNameContainer class="nameEditArea" :hand-up="handUp" />
  </div>
</template>

<style scoped>
.dragSurface {
  position: relative;
  cursor: grab;
  touch-action: none;
}
.dragSurface:active {
  cursor: grabbing;
}
.nameEditArea {
  position: relative;
  z-index: 4;
  width: 100%;
  max-width: 200px;
  pointer-events: auto;
}
.stageTileHost {
  position: relative;
  width: 200px;
  z-index: 1;
  overflow: visible;
}

.videoContainer {
  width: 200px;
  height: 200px;
  border-radius: 100px;
  position: relative;
  z-index: 1;
  overflow: visible;
}
.vid {
  position: relative;
  z-index: 1;
  width: 200px;
  height: 200px;
  border-radius: 999px;
  object-fit: cover;
  background: #0f172a;
  border: 7px solid var(--line-dark);
  display: block;
}
.vid.speaking {
  border-color: var(--color-blue100);
  animation: speakPulse 1.8s ease-in-out infinite;
}

@keyframes speakPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.65); }
  50%       { box-shadow: 0 0 0 14px rgba(79, 110, 247, 0.28); }
}
.local {
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  transition: left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.local.is-dragging {
  transition: none !important;
}
</style>

<style scoped src="./participantTileOverlays.css"></style>
