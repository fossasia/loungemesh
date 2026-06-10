<script setup lang="ts">
defineProps<{
  isRecording: boolean;
  quality: '720p' | '480p';
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'update:quality', value: '720p' | '480p'): void;
}>();
</script>

<template>
  <div class="recordGroup">
    <button
      type="button"
      class="recordBtn"
      :class="{ recording: isRecording }"
      aria-label="Record session"
      :title="isRecording ? 'Stop recording' : 'Start recording'"
      @click="emit('toggle')"
    >
      <span class="dot" :class="{ live: isRecording }" />
      <span class="recLabel">{{ isRecording ? 'Stop' : 'Rec' }}</span>
    </button>
    <select
      class="qualityPicker"
      :value="quality"
      :disabled="isRecording"
      :title="isRecording ? 'Cannot change quality while recording' : 'Recording quality'"
      @change="emit('update:quality', ($event.target as HTMLSelectElement).value as '720p' | '480p')"
    >
      <option value="720p">720p</option>
      <option value="480p">480p</option>
    </select>
  </div>
</template>

<style scoped>
.recordGroup {
  display: flex;
  align-items: center;
  gap: 4px;
}

.recordBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1.5px solid rgba(148, 163, 184, 0.4);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
  transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  letter-spacing: 0.02em;
}

.recordBtn:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.recordBtn.recording {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.6);
  color: #ef4444;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  animation: recRingPulse 2s ease-in-out infinite;
}

@keyframes recRingPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-mono60, #94a3b8);
  flex-shrink: 0;
  transition: background 0.2s;
}

.recordBtn:hover .dot {
  background: #ef4444;
}

.dot.live {
  background: #ef4444;
  animation: dotPulse 1.2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.7; }
}

.recLabel {
  line-height: 1;
}

.qualityPicker {
  padding: 6px 8px;
  border: 1.5px solid rgba(148, 163, 184, 0.4);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  appearance: none;
  -webkit-appearance: none;
  text-align: center;
}

.qualityPicker:not(:disabled):hover {
  border-color: rgba(79, 110, 247, 0.5);
  background: rgba(79, 110, 247, 0.08);
}

.qualityPicker:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
