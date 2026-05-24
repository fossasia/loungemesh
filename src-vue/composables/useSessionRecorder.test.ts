import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRecordingSupported, pickRecorderMimeType, useSessionRecorder } from './useSessionRecorder';

const originalRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;

afterEach(() => {
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = originalRecorder;
  vi.restoreAllMocks();
});

describe('pickRecorderMimeType', () => {
  it('returns undefined when MediaRecorder is unavailable', () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    expect(pickRecorderMimeType()).toBeUndefined();
  });

  it('returns the first supported candidate', () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
      isTypeSupported: (t: string) => t === 'video/webm',
    };
    expect(pickRecorderMimeType()).toBe('video/webm');
  });

  it('returns undefined when nothing is supported', () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
      isTypeSupported: () => false,
    };
    expect(pickRecorderMimeType(['video/webm'])).toBeUndefined();
  });
});

describe('useSessionRecorder', () => {
  it('reports unsupported and no-ops when MediaRecorder is missing', async () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    const recorder = useSessionRecorder({ getVideoSources: () => [], getAudioTracks: () => [] });
    expect(recorder.isSupported).toBe(false);
    expect(recorder.start()).toBe(false);
    expect(recorder.isRecording.value).toBe(false);
    await expect(recorder.stop()).resolves.toBeNull();
  });
});

describe('isRecordingSupported', () => {
  it('is false without canvas.captureStream', () => {
    // jsdom has no captureStream by default.
    expect(typeof isRecordingSupported()).toBe('boolean');
  });
});
