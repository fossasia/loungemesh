<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

withDefaults(
  defineProps<{
    onStage?: boolean;
  }>(),
  { onStage: false },
);
</script>

<template>
  <div v-if="onStage" class="base onStage">
    <AppIcon name="stage" class="ic" :size="32" />
    Presenting
  </div>
  <div v-else class="base avatar">
    <AppIcon name="user" class="ic" :size="48" />
  </div>
</template>

<style scoped>
.base {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--color-mono95);
  color: var(--color-mono30);
  font-weight: bold;
}
.ic {
  color: var(--color-mono40);
}
.onStage {
  background: var(--color-bg-inset);
  color: white;
}
.onStage .ic {
  margin-bottom: 4px;
  color: currentColor;
}
</style>
