import { describe, expect, it, vi } from 'vitest';
import { releaseLocalMediaTracks } from './releaseLocalMedia';

describe('releaseLocalMediaTracks', () => {
  it('removes tracks from the conference and disposes them', async () => {
    const dispose = vi.fn();
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    const track = {
      dispose,
      getOriginalStream: () => ({ getTracks: () => [{ stop: vi.fn() }] }),
    };
    releaseLocalMediaTracks([track as never], { removeTrack } as never);
    expect(removeTrack).toHaveBeenCalledWith(track);
    expect(dispose).toHaveBeenCalled();
  });

  it('disposes tracks when the conference has no removeTrack', () => {
    const dispose = vi.fn();
    releaseLocalMediaTracks([{ dispose } as never], {} as never);
    expect(dispose).toHaveBeenCalled();
  });

  it('disposes tracks when no conference is passed', () => {
    const dispose = vi.fn();
    releaseLocalMediaTracks([{ dispose } as never]);
    expect(dispose).toHaveBeenCalled();
  });

  it('disposes when removeTrack rejects', async () => {
    const dispose = vi.fn();
    const removeTrack = vi.fn().mockRejectedValue(new Error('gone'));
    releaseLocalMediaTracks([{ dispose } as never], { removeTrack } as never);
    await Promise.resolve();
    expect(dispose).toHaveBeenCalled();
  });
});
