import { describe, expect, it, vi } from 'vitest';
import { disposeJitsiTrack } from './disposeJitsiTrack';

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
