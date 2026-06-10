import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { SessionRecorder } from '@/composables/useSessionRecorder';
import { ensureRecordingMp4 } from '@/utils/recordingToMp4';

export type SessionRecordingControls = {
  recordingBlob: Ref<Blob | null>;
  hasRecording: ComputedRef<boolean>;
  toggleRecording: (quality?: '720p' | '480p') => Promise<void>;
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

  async function toggleRecording(quality?: '720p' | '480p'): Promise<void> {
    if (recorder.isRecording.value) {
      await stopIfRecording();
    } else {
      recorder.start(quality);
    }
  }

  async function downloadRecording(): Promise<void> {
    await stopIfRecording();
    const blob = recordingBlob.value;
    if (!blob?.size) return;
    try {
      const mp4Blob = await ensureRecordingMp4(blob);
      exportRecording(mp4Blob);
    } catch (error) {
      console.error('Failed to export session recording as MP4', error);
      window.alert('Could not export the recording as MP4. Please try again.');
    }
  }

  const hasRecording = computed(() => !!recordingBlob.value || recorder.isRecording.value);

  return { recordingBlob, hasRecording, toggleRecording, stopIfRecording, downloadRecording };
}
