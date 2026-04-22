<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

withDefaults(
  defineProps<{
    clickable?: boolean;
  }>(),
  { clickable: false },
);

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button
    v-if="clickable"
    type="button"
    class="muteBtn"
    aria-label="Unmute"
    @click.stop="emit('click')"
  >
    <AppIcon name="mic-off" :size="18" />
  </button>
  <span v-else class="muteBadge" aria-label="Muted">
    <AppIcon name="mic-off" :size="18" />
  </span>
</template>

<style scoped>
.muteBtn,
.muteBadge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-mono60);
  background: var(--btn-warning-bg);
  color: var(--btn-warning-fg);
  box-sizing: border-box;
  pointer-events: none;
}
.muteBtn {
  cursor: pointer;
  pointer-events: auto;
}
.muteBtn:hover {
  background: var(--btn-warning-bg-hover);
  border-color: var(--color-red100);
}
.muteBtn:active {
  background: var(--color-mono0);
}
</style>
