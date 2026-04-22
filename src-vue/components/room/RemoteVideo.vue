<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{ id: string; track?: JitsiTrackLike; speaking?: boolean }>();
const el = ref<HTMLVideoElement | null>(null);

onMounted(() => {
  if (props.track && el.value) props.track.attach?.(el.value);
});

watch(
  () => props.track,
  (t, prev) => {
    if (prev && el.value) prev.detach?.(el.value);
    if (t && el.value) t.attach?.(el.value);
  }
);

onBeforeUnmount(() => {
  if (props.track && el.value) props.track.detach?.(el.value);
});
</script>

<template>
  <video
    ref="el"
    autoplay
    playsinline
    class="remoteVideo"
    :class="{ speaking: !!speaking }"
    :id="`${id}video`"
  />
</template>

<style scoped>
.remoteVideo {
  width: 200px;
  height: 200px;
  border-radius: 999px;
  object-fit: cover;
  background: #0f172a;
  border: 4px solid var(--color-mono60);
  box-sizing: border-box;
}
.remoteVideo.speaking {
  border-color: var(--color-blue100);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.28);
}
</style>

