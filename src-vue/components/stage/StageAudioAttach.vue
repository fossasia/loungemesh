<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{
  track?: JitsiTrackLike;
  volume: number;
}>();

const audioEl = ref<HTMLAudioElement | null>(null);
let previousContainer: any | undefined;

function attach() {
  if (props.track && audioEl.value) {
    // Legacy behavior: detach from previous container first (StageAudio.tsx)
    const containers = (props.track as any)?.containers;
    if (containers && containers.length > 0) {
      previousContainer = containers[0];
      try {
        props.track.detach?.(previousContainer);
      } catch {
        // ignore
      }
    }
    if ((props.track as any)?.containers?.length === 0) {
      props.track.attach?.(audioEl.value);
    } else {
      props.track.attach?.(audioEl.value);
    }
  }
}

function detach() {
  if (props.track && audioEl.value) props.track.detach?.(audioEl.value);
  if (props.track && previousContainer) {
    try {
      props.track.attach?.(previousContainer);
    } catch {
      // ignore
    }
    previousContainer = undefined;
  }
}

onMounted(attach);
watch(() => props.track, () => {
  detach();
  attach();
});

watch(
  () => props.volume,
  (v) => {
    if (audioEl.value) audioEl.value.volume = v;
  }
);

onBeforeUnmount(detach);
</script>

<template>
  <audio v-if="track" ref="audioEl" autoplay class="aud" />
</template>

<style scoped>
.aud {
  display: none;
}
</style>
