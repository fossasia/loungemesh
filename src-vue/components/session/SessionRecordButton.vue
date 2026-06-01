<script setup lang="ts">
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps<{ isRecording: boolean }>();
defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <IconButton
    class="recordBtn"
    :label="isRecording ? 'Stop recording' : 'Record session'"
    :warning="isRecording"
    :sound="isRecording ? 'recordStop' : 'record'"
    @click="$emit('toggle')"
  >
    <template #icon>
      <AppIcon
        name="record"
        :stroke-width="isRecording ? 0 : 2"
        class="recordIcon"
        :class="{ live: isRecording }"
      />
    </template>
  </IconButton>
</template>

<style scoped>
.recordIcon.live {
  fill: var(--color-red100, #ef4444);
  stroke: var(--color-red100, #ef4444);
  animation: recPulse 1.4s ease-in-out infinite;
}

@keyframes recPulse {
  0%,
  100% {
    filter: drop-shadow(0 0 0 rgba(239, 68, 68, 0.45));
  }
  50% {
    filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.85));
  }
}
</style>
