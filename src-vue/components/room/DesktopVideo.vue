<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';
import { clearMediaElement } from '@/utils/clearMediaElement';

const props = defineProps<{ id: string; track?: JitsiTrackLike }>();
const el = ref<HTMLVideoElement | null>(null);

function attach(t?: JitsiTrackLike) {
  if (t && el.value) t.attach?.(el.value);
}
function detach(t?: JitsiTrackLike) {
  if (t && el.value) t.detach?.(el.value);
  clearMediaElement(el.value);
}

onMounted(() => {
  void nextTick(() => attach(props.track));
});
watch(
  () => props.track,
  async (t, prev) => {
    detach(prev);
    await nextTick();
    attach(t);
  },
);
onBeforeUnmount(() => detach(props.track));
</script>

<template>
  <div>
    <video ref="el" autoplay playsinline class="desktopVideo" :id="`${id}desktop`" />
  </div>
</template>

<style scoped>
/* Legacy `DesktopVideo` from src/components/User/RemoteUser/DesktopVideo.tsx */
.desktopVideo {
  position: relative;
  z-index: 1;
  width: auto;
  height: 200px;
  object-position: 50% 50%;
  display: block;
  border-radius: var(--radius-sm);
  transform: scaleX(1);
}
</style>

