<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{
  track?: JitsiTrackLike;
  mirrored?: boolean;
  /** Fill the stage frame edge-to-edge (no letterboxing). */
  fill?: boolean;
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
    :class="{ mirror: mirrored, fill }"
    autoplay
    playsinline
    disablePictureInPicture
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
.vid.fill {
  height: 100%;
  max-height: none;
}
.mirror {
  transform: scaleX(-1);
}
</style>
