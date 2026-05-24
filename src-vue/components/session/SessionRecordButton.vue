<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps<{ isRecording: boolean }>();
defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <button
    type="button"
    class="recordButton"
    :class="{ live: isRecording }"
    :aria-label="isRecording ? 'Stop recording' : 'Record session'"
    :title="isRecording ? 'Stop recording' : 'Record session'"
    @click="$emit('toggle')"
  >
    <span class="statusDot" aria-hidden="true" />
    <AppIcon name="record" />
    <span class="recordText">
      <strong>{{ isRecording ? 'Recording' : 'Record' }}</strong>
      <small>{{ isRecording ? 'Separated tiles + mixed audio' : 'Session .webm' }}</small>
    </span>
  </button>
</template>

<style scoped>
.recordButton {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 8px 14px;
  border: 2px solid transparent;
  border-radius: var(--radius-round);
  color: var(--btn-default-fg);
  background: var(--btn-default-bg);
  cursor: pointer;
  font-family: var(--font-body);
}
.recordButton:hover {
  background: var(--btn-default-bg-hover);
}
.recordButton.live {
  color: var(--btn-warning-fg);
  background: var(--btn-warning-bg);
  border-color: var(--color-red100);
}
.recordButton :deep(svg) {
  flex: 0 0 auto;
}
.statusDot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-mono60, #94a3b8);
}
.recordButton.live .statusDot {
  background: #ef4444;
  animation: recPulse 1.4s ease-in-out infinite;
}
.recordText {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}
.recordText strong {
  font-size: var(--fs-body, 1rem);
}
.recordText small {
  font-size: 0.72rem;
  opacity: 0.82;
}
@keyframes recPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}
@media (max-width: 768px) {
  .recordButton {
    min-height: 42px;
    padding: 8px 10px;
  }
  .recordText small {
    display: none;
  }
}
</style>
