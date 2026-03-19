<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{ id: string; track?: JitsiTrackLike }>();
const el = ref<HTMLVideoElement | null>(null);

function attach(t?: JitsiTrackLike) {
  if (t && el.value) t.attach?.(el.value);
}
function detach(t?: JitsiTrackLike) {
  if (t && el.value) t.detach?.(el.value);
}

onMounted(() => attach(props.track));
watch(
  () => props.track,
  (t, prev) => {
    detach(prev);
    attach(t);
  }
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
  width: auto;
  height: 200px;
  object-position: 50% 50%;
  display: block;
  border-radius: var(--radius-sm);
  transform: scaleX(1);
}
</style>

