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
/* Hearing range for proximity audio — matches app.chatmosphere.cc session UI */
.ring {
  position: absolute;
  left: 50%;
  top: 100px;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px dashed var(--color-mono60);
  opacity: 0.55;
  pointer-events: none;
  z-index: 0;
}
</style>
