<script setup lang="ts">
import { playUiSound } from '@/utils/uiSounds';

defineProps<{
  isHost: boolean;
  isRecording: boolean;
  recordingSupported: boolean;
  hasRecording: boolean;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'leave'): void;
  (e: 'export-notes'): void;
  (e: 'export-whiteboard'): void;
  (e: 'export-recording'): void;
  (e: 'toggle-recording'): void;
}>();

function onCancel() {
  playUiSound('tap');
  emit('cancel');
}

function onLeave() {
  playUiSound('leave');
  emit('leave');
}

function onExport() {
  playUiSound('tap');
}

function onToggleRecording(isRecording: boolean) {
  playUiSound(isRecording ? 'recordStop' : 'record');
}
</script>

<template>
  <div class="leaveBackdrop" @click.self="onCancel">
    <div class="leaveCard" role="dialog" aria-modal="true" aria-labelledby="leaveTitle">
      <h2 id="leaveTitle" class="title">Leave the session?</h2>

      <template v-if="isHost">
        <p class="sub">Export the session before you go — recordings save labeled participant tiles with mixed room audio.</p>
        <div class="exportGrid">
          <button type="button" class="export" @click="onExport(); emit('export-notes')">
            Download notes <span class="ext">.md</span>
          </button>
          <button type="button" class="export" @click="onExport(); emit('export-whiteboard')">
            Download whiteboard <span class="ext">.png</span>
          </button>
          <button
            v-if="recordingSupported"
            type="button"
            class="export"
            :disabled="!hasRecording"
            :title="hasRecording ? 'Download the recorded session' : 'Start a recording during the session to enable this'"
            @click="onExport(); emit('export-recording')"
          >
            Download recording <span class="ext">.webm</span>
          </button>
        </div>
        <button
          v-if="recordingSupported"
          type="button"
          class="record"
          @click="onToggleRecording(isRecording); emit('toggle-recording')"
        >
          <span class="dot" :class="{ live: isRecording }" />
          {{ isRecording ? 'Stop recording' : 'Start recording' }}
        </button>
      </template>
      <p v-else class="sub">You'll be disconnected from this space.</p>

      <div class="actions">
        <button type="button" class="btn cancel" @click="onCancel">Stay</button>
        <button type="button" class="btn leave" @click="onLeave">Leave call</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaveBackdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
}
.leaveCard {
  width: min(440px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 24px;
  background: var(--color-bg-card, #fff);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.3);
}
.title {
  margin: 0 0 8px;
  font-size: var(--fs-h2);
}
.sub {
  margin: 0 0 16px;
  color: var(--color-mono30);
}
.exportGrid {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}
.export {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: var(--radius-sm);
  background: var(--color-mono95, #f1f5f9);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--fs-body, 1rem);
}
.export:hover:not(:disabled) {
  background: var(--btn-default-bg-hover, #e2e8f0);
}
.export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ext {
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.record {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: var(--radius-sm);
  background: #fff;
  cursor: pointer;
  font-family: var(--font-body);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-mono60, #94a3b8);
}
.dot.live {
  background: #ef4444;
  animation: recPulse 1.4s ease-in-out infinite;
}
@keyframes recPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.btn {
  padding: 10px 18px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--fs-body, 1rem);
}
.btn.cancel {
  background: var(--btn-default-bg, #e2e8f0);
  color: var(--color-text-default, #1e293b);
}
.btn.leave {
  background: #ef4444;
  color: #fff;
}
</style>
