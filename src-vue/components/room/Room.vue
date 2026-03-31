<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { roomSize } from '@/constants/pan';

const props = defineProps<{ identifier?: string }>();

const backgroundUrl = ref('');

/** Optional room wallpaper from Eventyay JSON:API — only when `VITE_EVENTYAY_API_BASE` is set. */
watch(
  () => props.identifier,
  async (id) => {
    backgroundUrl.value = '';
    if (!id) return;
    const base = (import.meta.env.VITE_EVENTYAY_API_BASE as string | undefined)?.trim();
    if (!base) return;
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/v1/events/${encodeURIComponent(id)}/flowspace`,
        { headers: { Accept: 'application/vnd.api+json' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const url = data?.data?.attributes?.['bg-img-url']?.toString?.();
      if (url) backgroundUrl.value = url;
    } catch {
      /* optional background */
    }
  },
  { immediate: true }
);

const style = computed(() => ({
  width: `${roomSize.x}px`,
  height: `${roomSize.y}px`,
  backgroundImage: backgroundUrl.value ? `url("${backgroundUrl.value}")` : undefined,
  backgroundSize: backgroundUrl.value ? 'cover' : undefined,
}));
</script>

<template>
  <div class="room" :style="style" :data-identifier="props.identifier || ''">
    <slot />
  </div>
</template>

<style scoped>
/* Legacy `RoomContainer` — optional event background; else neutral canvas */
.room {
  position: relative;
  box-sizing: border-box;
  display: block;
  background-color: var(--color-mono95);
  background-repeat: no-repeat;
  background-position: center;
}
</style>
