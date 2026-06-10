<script setup lang="ts">
import { computed } from 'vue';
import { useLoungeBackgroundUrl } from '@/composables/useLoungeBackgroundUrl';
import { viewportBackgroundStyle } from '@/utils/gridBackgroundImage';

const props = defineProps<{ eventIdentifier?: string }>();

const backgroundUrl = useLoungeBackgroundUrl(() => props.eventIdentifier);

const style = computed(() => {
  const url = backgroundUrl.value;
  if (!url) return undefined;
  return viewportBackgroundStyle(url);
});
</script>

<template>
  <div v-if="style" class="viewportBackground" :style="style" aria-hidden="true" />
</template>

<style scoped>
.viewportBackground {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 0;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
}
</style>
