<script setup lang="ts">
import { computed } from 'vue';
import { useLocalStore } from '@/stores/localStore';

const props = defineProps<{ identifier?: string }>();

const local = useLocalStore();

const roomStyle = computed(() => {
  const { origin, size } = local.roomBounds;
  return {
    width: `${size.x}px`,
    height: `${size.y}px`,
    transform: `translate(${origin.x}px, ${origin.y}px)`,
  };
});
</script>

<template>
  <div class="room" :style="roomStyle" :data-identifier="props.identifier || ''">
    <slot />
  </div>
</template>

<style scoped>
/* Transparent so the fixed viewport wallpaper shows through while panning. */
.room {
  position: relative;
  box-sizing: border-box;
  display: block;
  background-color: transparent;
}
</style>
