<script setup lang="ts">
defineProps<{ active?: boolean }>();
</script>

<template>
  <div class="speakRing" :class="{ active: !!active }" aria-hidden="true" />
</template>

<style scoped>
.speakRing {
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  border: 3px solid transparent;
  pointer-events: none;
  z-index: 2;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.speakRing.active {
  border-color: var(--color-green100, #22c55e);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.35), 0 0 18px rgba(34, 197, 94, 0.45);
  animation: speakPulse 1.2s ease-in-out infinite;
}
@keyframes speakPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}
</style>
