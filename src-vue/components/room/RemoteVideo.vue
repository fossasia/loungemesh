<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{ id: string; track?: JitsiTrackLike; speaking?: boolean }>();
const el = ref<HTMLVideoElement | null>(null);

async function attachTrack(track: typeof props.track) {
  if (!track || !el.value) return;
  try {
    track.detach?.(el.value);
  } catch {
    /* not attached yet */
  }
  track.attach?.(el.value);
}

onMounted(() => {
  void nextTick(() => attachTrack(props.track));
});

watch(
  () => props.track,
  async (t, prev) => {
    if (prev && el.value) {
      try {
        prev.detach?.(el.value);
      } catch {
        /* ignore */
      }
    }
    await nextTick();
    await attachTrack(t);
  },
);

watch(el, (node) => {
  if (node && props.track) void attachTrack(props.track);
});

onBeforeUnmount(() => {
  if (props.track && el.value) {
    try {
      props.track.detach?.(el.value);
    } catch {
      /* ignore */
    }
  }
});
</script>

<template>
  <video
    ref="el"
    autoplay
    playsinline
    class="remoteVideo"
    :class="{ speaking: !!speaking, hidden: !!track?.isMuted?.() }"
    :id="`${id}video`"
  />
</template>

<style scoped>
.remoteVideo {
  position: relative;
  z-index: 1;
  display: block;
  width: 200px;
  height: 200px;
  border-radius: 999px;
  object-fit: cover;
  background: #0f172a;
  border: 4px solid var(--color-mono60);
  box-sizing: border-box;
}
.remoteVideo.hidden {
  visibility: hidden;
}
.remoteVideo.speaking {
  border-color: var(--color-blue100);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.28);
}
</style>
