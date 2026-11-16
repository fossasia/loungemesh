<script setup lang="ts">
import { audioRadius } from '@/utils/vector';
</script>

<template>
  <div
    class="ring"
    :style="{ width: `${audioRadius * 2}px`, height: `${audioRadius * 2}px` }"
    aria-hidden="true"
  />
</template>

<style scoped>
/* Hearing range circle for proximity audio (dashed ring around local user) */
.ring {
  position: absolute;
  left: 50%;
  top: 100px;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  border-radius: 50%;
  border: 5px solid var(--line-dark);
  opacity: 1;
  pointer-events: none;
  z-index: 0;
}
</style>
