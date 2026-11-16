import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useSessionRecording } from './useSessionRecording';
import type { SessionRecorder } from './useSessionRecorder';

vi.mock('@/utils/recordingToMp4', () => ({
  ensureRecordingMp4: vi.fn(async (blob: Blob) => blob),
}));

function fakeRecorder(recording = false, stopBlob: Blob | null = null) {
  const recorder: SessionRecorder = {
    isSupported: true,
    isRecording: ref(recording),
    start: vi.fn(() => true),
    stop: vi.fn(async () => stopBlob),
  };
  return recorder as SessionRecorder & {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
}

describe('useSessionRecording', () => {
  it('starts the recorder when not recording', async () => {
    const rec = fakeRecorder(false);
    const controls = useSessionRecording(rec, vi.fn());
    await controls.toggleRecording();
    expect(rec.start).toHaveBeenCalled();
    expect(rec.stop).not.toHaveBeenCalled();
    expect(controls.hasRecording.value).toBe(false);
  });

  it('starts the recorder with a specified quality', async () => {
    const rec = fakeRecorder(false);
    const controls = useSessionRecording(rec, vi.fn());
    await controls.toggleRecording('480p');
    expect(rec.start).toHaveBeenCalledWith('480p');
  });

  it('stops and stores the blob when recording', async () => {
    const blob = new Blob(['v']);
    const rec = fakeRecorder(true, blob);
    const controls = useSessionRecording(rec, vi.fn());
    await controls.toggleRecording();
    expect(rec.stop).toHaveBeenCalled();
    expect(controls.recordingBlob.value).toBe(blob);
    rec.isRecording.value = false;
    expect(controls.hasRecording.value).toBe(true);
  });

  it('stopIfRecording no-ops when not recording', async () => {
    const rec = fakeRecorder(false);
    const controls = useSessionRecording(rec, vi.fn());
    await controls.stopIfRecording();
    expect(rec.stop).not.toHaveBeenCalled();
  });

  it('downloadRecording stops then exports the blob', async () => {
    const blob = new Blob(['v']);
    const rec = fakeRecorder(true, blob);
    const exportFn = vi.fn();
    const controls = useSessionRecording(rec, exportFn);
    await controls.downloadRecording();
    expect(exportFn).toHaveBeenCalledWith(blob);
  });

  it('downloadRecording does nothing without a recording', async () => {
    const rec = fakeRecorder(false, null);
    const exportFn = vi.fn();
    const controls = useSessionRecording(rec, exportFn);
    await controls.downloadRecording();
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('downloadRecording does nothing for an empty blob', async () => {
    const rec = fakeRecorder(false, new Blob());
    const exportFn = vi.fn();
    const controls = useSessionRecording(rec, exportFn);
    await controls.downloadRecording();
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('handles error in ensureRecordingMp4 during downloadRecording', async () => {
    const { ensureRecordingMp4 } = await import('@/utils/recordingToMp4');
    vi.mocked(ensureRecordingMp4).mockRejectedValueOnce(new Error('encoding failed'));
    
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const blob = new Blob(['v']);
    const rec = fakeRecorder(true, blob);
    const exportFn = vi.fn();
    const controls = useSessionRecording(rec, exportFn);
    
    await controls.downloadRecording();
    
    expect(alertSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(exportFn).not.toHaveBeenCalled();
    
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
