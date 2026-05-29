import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';

describe('installMediaPlaybackUnlock', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers event listeners and calls resumePlayback on gesture', async () => {
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
    install(engine);

    window.dispatchEvent(new PointerEvent('pointerdown'));
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

  it('resolves whenPlaybackUnlocked after the first gesture', async () => {
    const { installMediaPlaybackUnlock, whenPlaybackUnlocked } = await import(
      './resumeMediaPlayback'
    );
    installMediaPlaybackUnlock({ resumePlayback: vi.fn() } as never);
    const pending = whenPlaybackUnlocked();
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await expect(pending).resolves.toBeUndefined();
  });

  it('resolves whenPlaybackUnlocked immediately after unlock', async () => {
    const { installMediaPlaybackUnlock, whenPlaybackUnlocked } = await import(
      './resumeMediaPlayback'
    );
    installMediaPlaybackUnlock({ resumePlayback: vi.fn() } as never);
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await expect(whenPlaybackUnlocked()).resolves.toBeUndefined();
  });

  it('unlockMediaPlaybackNow resumes the engine without waiting for a gesture', async () => {
    const { unlockMediaPlaybackNow } = await import('./resumeMediaPlayback');
    const resume = vi.fn();
    unlockMediaPlaybackNow({ resumePlayback: resume } as never);
    expect(resume).toHaveBeenCalledTimes(1);
    unlockMediaPlaybackNow({ resumePlayback: resume } as never);
    expect(resume).toHaveBeenCalledTimes(2);
  });
});
