<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{
  id: string;
  track?: JitsiTrackLike;
  volume: number;
}>();

const el = ref<HTMLAudioElement | null>(null);

watch(
  () => props.volume,
  (v) => {
    if (el.value) el.value.volume = v;
  },
  { immediate: true }
);

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
  <audio ref="el" autoplay class="remoteAudio" :id="`${id}audio`" />
</template>

