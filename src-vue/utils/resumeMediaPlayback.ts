import type { MediaService } from '@/services/MediaService';

let installed = false;

/** Browsers block Web Audio until a user gesture — call once per session. */
export function installMediaPlaybackUnlock(engine: MediaService): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const resume = () => {
    engine.resumePlayback?.();
  };
  window.addEventListener('pointerdown', resume, { once: true, capture: true });
  window.addEventListener('keydown', resume, { once: true, capture: true });
}
