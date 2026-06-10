<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrack } from '@/types/jitsi';
import { clearMediaElement } from '@/utils/clearMediaElement';

const props = defineProps<{
  track: JitsiTrack;
  /** Fill the stage frame edge-to-edge (no letterboxing). */
  fill?: boolean;
}>();
const videoEl = ref<HTMLVideoElement | null>(null);

function attachTrack(t: JitsiTrack) {
  if (videoEl.value && t) {
    clearMediaElement(videoEl.value);
    try {
      t.attach(videoEl.value);
      if (videoEl.value.paused) {
        const playPromise = videoEl.value.play();
        if (playPromise) {
          playPromise.catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to attach screenshare track', err);
    }
  }
}

function detachTrack(t: JitsiTrack) {
  if (t && videoEl.value) {
    try {
      t.detach(videoEl.value);
    } catch {
      /* ignore */
    }
  }
  clearMediaElement(videoEl.value);
}

onMounted(() => {
  void nextTick(() => {
    if (props.track) attachTrack(props.track);
  });
});

watch(
  () => props.track,
  async (newTrack, oldTrack) => {
    if (oldTrack) detachTrack(oldTrack);
    if (!newTrack) {
      clearMediaElement(videoEl.value);
      return;
    }
    await nextTick();
    attachTrack(newTrack);
  }
);

watch(videoEl, (node) => {
  if (node && props.track) attachTrack(props.track);
});

onBeforeUnmount(() => {
  if (props.track) detachTrack(props.track);
});
</script>

<template>
  <video
    ref="videoEl"
    autoplay
    playsinline
    muted
    class="screenshareVideo"
    :class="{ fill }"
  />
</template>

<style scoped>
.screenshareVideo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #0f172a;
  border-radius: var(--radius-sm);
  border: 2px solid var(--line-dark);
  display: block;
}
.screenshareVideo.fill {
  border: none;
  border-radius: 0;
}
</style>
