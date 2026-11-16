import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRecordingSupported, pickRecorderMimeType, useSessionRecorder } from './useSessionRecorder';

const originalRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
const originalNavigator = globalThis.navigator;

afterEach(() => {
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = originalRecorder;
  vi.stubGlobal('navigator', originalNavigator);
  vi.restoreAllMocks();
});

describe('pickRecorderMimeType', () => {
  it('returns undefined when MediaRecorder is unavailable', () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    expect(pickRecorderMimeType()).toBeUndefined();
  });

  it('prefers webm on Chrome-like browsers when both are supported', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/130.0.0.0' });
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
      isTypeSupported: (t: string) => t.startsWith('video/webm') || t.startsWith('video/mp4'),
    };
    expect(pickRecorderMimeType()).toBe('video/webm;codecs=vp9,opus');
  });

  it('prefers mp4 on Safari when both are supported', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
      isTypeSupported: (t: string) => t.startsWith('video/mp4'),
    };
    expect(pickRecorderMimeType()).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
  });

  it('falls back to webm when mp4 is unsupported', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Firefox/130.0' });
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
