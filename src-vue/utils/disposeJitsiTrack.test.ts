import { describe, expect, it, vi } from 'vitest';
import { disposeJitsiTrack, stopTrackStream } from './disposeJitsiTrack';

describe('disposeJitsiTrack', () => {
  it('calls dispose when present', () => {
    const dispose = vi.fn();
    const stop = vi.fn();
    disposeJitsiTrack({
      dispose,
      getOriginalStream: () => ({ getTracks: () => [{ stop }] }),
    } as never);
    expect(stop).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it('ignores missing and failing tracks', () => {
    expect(() => disposeJitsiTrack(undefined)).not.toThrow();
    expect(() =>
      disposeJitsiTrack({
        dispose: () => {
          throw new Error('fail');
        },
      } as never),
    ).not.toThrow();
  });
});

describe('stopTrackStream', () => {
  it('stops the underlying media tracks without disposing the Jitsi track', () => {
    const stop = vi.fn();
    const dispose = vi.fn();
    stopTrackStream({
      dispose,
      getTrack: () => ({ stop }),
    } as never);
    expect(stop).toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
  });

  it('collects raw tracks from the legacy track and stream properties', () => {
    const stopTrack = vi.fn();
    const stopStream = vi.fn();
    const stopGetStream = vi.fn();
    stopTrackStream({
      getStream: () => ({ getTracks: () => [{ stop: stopGetStream }] }),
      track: { stop: stopTrack },
      stream: { getTracks: () => [{ stop: stopStream }] },
    } as never);
    expect(stopTrack).toHaveBeenCalled();
    expect(stopStream).toHaveBeenCalled();
    expect(stopGetStream).toHaveBeenCalled();
  });
});
