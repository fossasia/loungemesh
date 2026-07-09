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
  border: 1.5px solid var(--line-dark, #cbd5e1);
  border-radius: 20px;
  background: var(--btn-default-bg, #f1f5f9);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: var(--fw-medium);
  color: var(--btn-default-fg, #1e293b);
  transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  letter-spacing: 0.02em;
}

.recordBtn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #ef4444;
  transform: translateY(-1px);
  box-shadow: none;
}

.recordBtn.recording {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  animation: recRingPulse 2s ease-in-out infinite;
}

.recordBtn.recording .dot {
  background: #ffffff;
}

@keyframes recRingPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
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
  background: #ffffff;
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
  border: 1.5px solid var(--line-dark, #cbd5e1);
  border-radius: 16px;
  background: var(--btn-default-bg, #f1f5f9);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: var(--fw-medium);
  color: var(--btn-default-fg, #1e293b);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  appearance: none;
  -webkit-appearance: none;
  text-align: center;
}

.qualityPicker option {
  background: var(--btn-default-bg, #f1f5f9);
  color: var(--btn-default-fg, #1e293b);
}

.qualityPicker:not(:disabled):hover {
  border-color: #a5b4fc;
  background: var(--btn-default-bg-hover, #e2e8f0);
}

.qualityPicker:disabled {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 1;
}
</style>
