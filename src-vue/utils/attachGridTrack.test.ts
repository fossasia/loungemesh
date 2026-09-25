import { describe, expect, it, vi } from 'vitest';
import { makeTrack } from '@/test/makeTrack';
import { attachGridTrack, detachGridTrack } from './attachGridTrack';

describe('attachGridTrack', () => {
  it('no-ops without an element', () => {
    const track = makeTrack('video');
    attachGridTrack(null, track);
    expect(track.attach).not.toHaveBeenCalled();
  });

  it('clears when no track is provided', () => {
    const el = document.createElement('video');
    attachGridTrack(el, undefined);
  });

  it('attaches a live track', () => {
    const el = document.createElement('video');
    const track = makeTrack('video');
    attachGridTrack(el, track);
    expect(track.attach).toHaveBeenCalledWith(el);
  });
});

describe('detachGridTrack', () => {
  it('detaches and ignores failures', () => {
    const el = document.createElement('video');
    const track = makeTrack('video');
    (track.detach as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('gone');
    });
    detachGridTrack(el, track);
    detachGridTrack(null, track);
    detachGridTrack(el, undefined);
  });
});
