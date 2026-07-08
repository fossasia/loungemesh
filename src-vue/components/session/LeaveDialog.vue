<script setup lang="ts">
import { playUiSound } from '@/utils/uiSounds';

defineProps<{
  isHost: boolean;
  isRecording: boolean;
  recordingSupported: boolean;
  hasRecording: boolean;
  quality: '720p' | '480p';
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'leave'): void;
  (e: 'export-notes'): void;
  (e: 'export-whiteboard'): void;
  (e: 'export-recording'): void;
  (e: 'toggle-recording'): void;
  (e: 'update:quality', value: '720p' | '480p'): void;
}>();

function onCancel() {
  playUiSound('tap');
  emit('cancel');
}

function onLeave() {
  playUiSound('leave');
  emit('leave');
}

function onExport(type: string) {
  playUiSound('tap');
  if (type === 'notes') emit('export-notes');
  else if (type === 'whiteboard') emit('export-whiteboard');
  else if (type === 'recording') emit('export-recording');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div class="leaveBackdrop" @click.self="onCancel">
        <Transition name="card" appear>
          <div class="leaveCard" role="dialog" aria-modal="true" aria-labelledby="leaveTitle">

            <!-- Icon header -->
            <div class="cardIcon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>

            <h2 id="leaveTitle" class="title">Leave session?</h2>
            <p class="sub">
              {{ isHost
                ? 'Download your session data before leaving.'
                : "You'll be removed from this space." }}
            </p>

            <!-- Host export section -->
            <template v-if="isHost">
              <div class="exportGrid">
                <button type="button" class="export" @click="onExport('notes')">
                  <div class="exportLeft">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="exportIcon">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span>Public Notes</span>
                  </div>
                  <span class="ext">.md</span>
                </button>

                <button type="button" class="export" @click="onExport('whiteboard')">
                  <div class="exportLeft">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="exportIcon">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Whiteboard</span>
                  </div>
                  <span class="ext">.png</span>
                </button>

                <button
                  v-if="recordingSupported"
                  type="button"
                  class="export"
                  :class="{ disabled: !hasRecording }"
                  :disabled="!hasRecording"
                  :title="hasRecording ? 'Download the recorded session' : 'No recording available — start one from the toolbar'"
                  @click="onExport('recording')"
                >
                  <div class="exportLeft">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="exportIcon">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>Recording</span>
                    <span v-if="isRecording" class="livePill">LIVE</span>
                  </div>
                  <span class="ext">.mp4</span>
                </button>
              </div>
            </template>

            <!-- Actions -->
            <div class="actions">
              <button type="button" class="btn cancel" @click="onCancel">Stay</button>
              <button type="button" class="btn leave" @click="onLeave">
                Leave call
              </button>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ---------- backdrop ---------- */
.leaveBackdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 15, 30, 0.6);
  backdrop-filter: blur(4px);
}

/* backdrop fade */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.22s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* ---------- card ---------- */
.leaveCard {
  width: min(420px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 28px 24px 24px;
  background: var(--color-bg-card, #fff);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 20px 60px rgba(10, 15, 40, 0.22);
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* card slide-up + fade */
.card-enter-active {
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.22s ease;
}
.card-leave-active {
  transition: transform 0.18s ease-in, opacity 0.18s ease-in;
}
.card-enter-from {
  transform: translateY(24px) scale(0.97);
  opacity: 0;
}
.card-leave-to {
  transform: translateY(10px) scale(0.97);
  opacity: 0;
}

/* ---------- icon header ---------- */
.cardIcon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.title {
  margin: 0 0 6px;
  font-size: 1.2rem;
  font-weight: var(--fw-bold, 700);
  font-family: var(--font-display);
  color: var(--color-text-default);
  letter-spacing: -0.01em;
}

.sub {
  margin: 0 0 20px;
  font-size: var(--fs-small, 0.875rem);
  color: var(--color-mono30, #64748b);
  line-height: 1.5;
}

/* ---------- export grid ---------- */
.exportGrid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.export {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: 10px;
  background: var(--color-mono95, #f8fafc);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--fs-small, 0.875rem);
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
  transition: background 0.18s, border-color 0.18s, transform 0.15s, box-shadow 0.18s;
  text-align: left;
  width: 100%;
}

.export:hover:not(:disabled):not(.disabled) {
  background: #f1f5f9;
  border-color: rgba(79, 110, 247, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(79, 110, 247, 0.08);
}

.export:active:not(:disabled):not(.disabled) {
  transform: translateY(0);
}

.export:disabled,
.export.disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.exportLeft {
  display: flex;
  align-items: center;
  gap: 10px;
}

.exportIcon {
  color: var(--color-mono30, #94a3b8);
  flex-shrink: 0;
}

.export:hover:not(:disabled):not(.disabled) .exportIcon {
  color: var(--color-blue100, #4f6ef7);
}

.ext {
  font-size: 0.75rem;
  font-weight: var(--fw-medium);
  color: var(--color-mono30);
  background: var(--line-light, #e2e8f0);
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.livePill {
  font-size: 0.65rem;
  font-weight: var(--fw-bold);
  background: #ef4444;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.06em;
  animation: livePulse 1.5s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ---------- action buttons ---------- */
.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
}

.btn {
  padding: 10px 22px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--fs-small, 0.875rem);
  font-weight: var(--fw-medium);
  transition: background 0.18s, transform 0.15s, box-shadow 0.18s;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

.btn.cancel {
  background: var(--btn-default-bg, #f1f5f9);
  color: var(--color-text-default, #1e293b);
  border: 1px solid var(--line-light, #e2e8f0);
}

.btn.cancel:hover {
  background: #e2e8f0;
}

.btn.leave {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
}

.btn.leave:hover {
  box-shadow: 0 6px 18px rgba(239, 68, 68, 0.4);
}
</style>
