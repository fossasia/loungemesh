<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { JitsiTrack } from '@/types/jitsi';
import { attachGridTrack, detachGridTrack } from '@/utils/attachGridTrack';

const props = defineProps<{
  track?: JitsiTrack;
  muted?: boolean;
}>();

const el = ref<HTMLVideoElement | null>(null);

watch(
  () => props.track,
  async (track) => {
    await nextTick();
    attachGridTrack(el.value, track);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  detachGridTrack(el.value, props.track);
});
</script>

<template>
  <video ref="el" class="vid" autoplay playsinline :muted="!!muted" />
</template>

<style scoped>
.vid {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #0f172a;
}
</style>
