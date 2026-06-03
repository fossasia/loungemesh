import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { SessionRecorder } from '@/composables/useSessionRecorder';

export type SessionRecordingControls = {
  recordingBlob: Ref<Blob | null>;
  hasRecording: ComputedRef<boolean>;
  toggleRecording: () => Promise<void>;
  stopIfRecording: () => Promise<void>;
  downloadRecording: () => Promise<void>;
};

/**
 * Recording controls wired around a SessionRecorder. Kept separate from the
 * recorder (and injected) so the start/stop/download decisions are testable
 * without the browser MediaRecorder/canvas APIs.
 */
export function useSessionRecording(
  recorder: SessionRecorder,
  exportRecording: (blob: Blob) => void,
): SessionRecordingControls {
  const recordingBlob = ref<Blob | null>(null);

  async function stopIfRecording(): Promise<void> {
    if (recorder.isRecording.value) {
      recordingBlob.value = await recorder.stop();
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recorder.isRecording.value) {
      await stopIfRecording();
    } else {
      recorder.start();
    }
  }

  async function downloadRecording(): Promise<void> {
    await stopIfRecording();
    if (recordingBlob.value) exportRecording(recordingBlob.value);
  }

  const hasRecording = computed(() => !!recordingBlob.value || recorder.isRecording.value);

  return { recordingBlob, hasRecording, toggleRecording, stopIfRecording, downloadRecording };
}
