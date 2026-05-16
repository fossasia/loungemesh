<script setup lang="ts">
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps<{ isRecording: boolean }>();
defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <IconButton
    :label="isRecording ? 'Stop recording' : 'Record session'"
    :warning="isRecording"
    @click="$emit('toggle')"
  >
    <template #icon><AppIcon name="record" /></template>
  </IconButton>
</template>
