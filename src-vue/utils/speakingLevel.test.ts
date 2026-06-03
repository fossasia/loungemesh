import { describe, expect, it, vi } from 'vitest';
import { startSpeakingLevelMonitor } from './speakingLevel';

describe('startSpeakingLevelMonitor', () => {
  it('reports speaking transitions from analyser levels', () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const buf = new Uint8Array(4);
    const analyser = {
      fftSize: 512,
      smoothingTimeConstant: 0.65,
      frequencyBinCount: 4,
      getByteFrequencyData: vi.fn((target: Uint8Array) => {
        target.set(buf);
      }),
    };
    const onChange = vi.fn();
    const stop = startSpeakingLevelMonitor({
      analyser: analyser as unknown as AnalyserNode,
      isInactive: () => false,
      onChange,
    });
    buf.fill(80);
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(true);
    onChange.mockClear();
    stop();
    expect(onChange).toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });

  it('clears speaking while inactive', () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let inactive = false;
    const analyser = {
      fftSize: 512,
      smoothingTimeConstant: 0.65,
      frequencyBinCount: 4,
      getByteFrequencyData: vi.fn((target: Uint8Array) => {
        target.fill(80);
      }),
    };
    const onChange = vi.fn();
    const stop = startSpeakingLevelMonitor({
      analyser: analyser as unknown as AnalyserNode,
      isInactive: () => inactive,
      onChange,
    });
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(true);
    onChange.mockClear();
    inactive = true;
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(false);
    stop();
    vi.unstubAllGlobals();
  });
});
