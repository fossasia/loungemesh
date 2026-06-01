<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{
  track?: JitsiTrackLike;
  mirrored?: boolean;
}>();

const videoEl = ref<HTMLVideoElement | null>(null);

function attach() {
  if (props.track && videoEl.value) props.track.attach?.(videoEl.value);
}

function detach() {
  if (props.track && videoEl.value) props.track.detach?.(videoEl.value);
}

onMounted(attach);
watch(() => props.track, () => {
  detach();
  attach();
});

onBeforeUnmount(detach);
</script>

<template>
  <video
    v-if="track"
    ref="videoEl"
    class="vid"
    :class="{ mirror: mirrored }"
    autoplay
    playsinline
  />
</template>

<style scoped>
.vid {
  display: block;
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  background: #0f172a;
}
.mirror {
  transform: scaleX(-1);
}
</style>
