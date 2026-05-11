import type { MediaService } from '@/services/MediaService';

let installed = false;

/**
 * Browsers block Web Audio until a user gesture.
 * We resume the AudioContext on every relevant gesture (not just the first)
 * because it can become suspended again after the tab is hidden/restored.
 * We also eagerly create the AudioContext on first gesture so it exists
 * before remote tracks arrive.
 */
export function installMediaPlaybackUnlock(engine: MediaService): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const resume = () => {
    engine.resumePlayback?.();
  };
  // No { once: true } — fire on every interaction to handle suspended→running transitions
  window.addEventListener('pointerdown', resume, { capture: true });
  window.addEventListener('click', resume, { capture: true });
  window.addEventListener('keydown', resume, { capture: true });
}
