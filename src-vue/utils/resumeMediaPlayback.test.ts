import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installMediaPlaybackUnlock } from './resumeMediaPlayback';

describe('installMediaPlaybackUnlock', () => {
  beforeEach(() => {
    // Reset the module-level `installed` flag between tests by re-importing.
    // We do this by directly manipulating the listeners array from window.
    vi.resetModules();
  });

  it('registers event listeners and calls resumePlayback on gesture', async () => {
    // Fresh import so `installed` is false
    const { installMediaPlaybackUnlock: install } = await import('./resumeMediaPlayback');
    const resume = vi.fn();
    const engine = { resumePlayback: resume } as never;

    install(engine);

    window.dispatchEvent(new PointerEvent('pointerdown'));
    expect(resume).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new MouseEvent('click'));
    expect(resume).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new KeyboardEvent('keydown'));
    expect(resume).toHaveBeenCalledTimes(3);
  });

  it('does not install twice (idempotent)', async () => {
    const { installMediaPlaybackUnlock: install } = await import('./resumeMediaPlayback');
    const resume = vi.fn();
    const engine = { resumePlayback: resume } as never;

    install(engine);
    install(engine); // second call — should be a no-op

    window.dispatchEvent(new PointerEvent('pointerdown'));
    // Still only 1 listener registered, so called once
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('handles engine without resumePlayback gracefully', async () => {
    const { installMediaPlaybackUnlock: install } = await import('./resumeMediaPlayback');
    const engine = {} as never;

    expect(() => {
      install(engine);
      window.dispatchEvent(new PointerEvent('pointerdown'));
    }).not.toThrow();
  });
});
