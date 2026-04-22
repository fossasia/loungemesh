import { describe, expect, it, vi } from 'vitest';
import type { JitsiTrack } from '@/types/jitsi';
import { bindScreenshareEndWatch } from './screenshareDesktopWatch';

describe('bindScreenshareEndWatch', () => {
  it('no-ops for missing or non-desktop tracks', () => {
    const onEnd = vi.fn();
    expect(bindScreenshareEndWatch(undefined, onEnd)()).toBeUndefined();
    expect(
      bindScreenshareEndWatch({ videoType: 'camera' } as JitsiTrack, onEnd)(),
    ).toBeUndefined();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('forwards desktop track end events', () => {
    const listeners: Record<string, () => void> = {};
    const vt = {
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    const track = {
      videoType: 'desktop',
      getOriginalStream: () => ({ getVideoTracks: () => [vt] }),
    } as unknown as JitsiTrack;
    const onEnd = vi.fn();
    const unbind = bindScreenshareEndWatch(track, onEnd);
    listeners.ended?.();
    expect(onEnd).toHaveBeenCalled();
    unbind();
  });
});
