import { describe, expect, it, vi } from 'vitest';
import type { JitsiTrack } from '@/types/jitsi';
import { onVideoTrackEnded } from './trackLifecycle';

describe('onVideoTrackEnded', () => {
  it('calls onEnd when the media track ends', () => {
    const listeners: Record<string, () => void> = {};
    const vt = {
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    const stream = { getVideoTracks: () => [vt] } as unknown as MediaStream;
    const track = {
      getOriginalStream: () => stream,
    } as unknown as JitsiTrack;
    const onEnd = vi.fn();
    const unbind = onVideoTrackEnded(track, onEnd);
    listeners.ended?.();
    expect(onEnd).toHaveBeenCalled();
    unbind();
  });

  it('no-ops when stream is missing', () => {
    const onEnd = vi.fn();
    onVideoTrackEnded({} as JitsiTrack, onEnd);
    expect(onEnd).not.toHaveBeenCalled();
  });
});
