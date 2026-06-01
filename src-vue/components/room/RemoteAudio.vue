<script setup lang="ts">
/**
 * Spatial audio is routed through Web Audio GainNodes in JitsiAdapter.
 * This component exists for layout parity and future metering UI.
 */
defineProps<{
  id: string;
  volume?: number;
}>();
</script>

<template>
  <span class="remoteAudio" :id="`${id}audio`" aria-hidden="true" />
</template>
