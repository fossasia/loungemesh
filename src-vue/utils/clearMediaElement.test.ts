import { describe, expect, it, vi } from 'vitest';
import { clearMediaElement, waitForMediaElementDetach } from './clearMediaElement';

describe('clearMediaElement', () => {
  it('clears srcObject and pauses the element', () => {
    const pause = vi.fn();
    const el = {
      pause,
      srcObject: { id: 'stream' } as MediaStream,
      removeAttribute: vi.fn(),
    } as unknown as HTMLMediaElement;
    clearMediaElement(el);
    expect(pause).toHaveBeenCalled();
    expect(el.srcObject).toBeNull();
    expect(el.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('stops capture tracks when requested', () => {
    const stop = vi.fn();
    const el = {
      pause: vi.fn(),
      srcObject: { getTracks: () => [{ stop }] } as unknown as MediaStream,
      removeAttribute: vi.fn(),
    } as unknown as HTMLVideoElement;
    clearMediaElement(el, { stopTracks: true });
    expect(stop).toHaveBeenCalled();
    expect(el.srcObject).toBeNull();
  });

  it('ignores null elements and pause failures', () => {
    expect(() => clearMediaElement(null)).not.toThrow();
    const el = {
      pause: () => {
        throw new Error('pause failed');
      },
      srcObject: {},
      removeAttribute: vi.fn(),
    } as unknown as HTMLMediaElement;
    expect(() => clearMediaElement(el)).not.toThrow();
    expect(el.srcObject).toBeNull();
  });
});

describe('waitForMediaElementDetach', () => {
  it('resolves after two animation frames', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    await expect(waitForMediaElementDetach()).resolves.toBeUndefined();
  });
});
