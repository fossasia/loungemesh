import type { MediaService } from '@/services/MediaService';
import { unlockAudioContextConstructor } from '@/utils/jitsiConsole';

let installed = false;
let playbackUnlocked = false;
const pendingUnlock: Array<() => void> = [];

export function whenPlaybackUnlocked(): Promise<void> {
  if (playbackUnlocked) return Promise.resolve();
  return new Promise((resolve) => {
    pendingUnlock.push(resolve);
  });
}

/** Test helper */
export function resetMediaPlaybackUnlockForTests(): void {
  installed = false;
  playbackUnlocked = false;
  pendingUnlock.length = 0;
}

/** Unlock Web Audio immediately (safe after an explicit user gesture or getUserMedia). */
export function unlockMediaPlaybackNow(engine?: MediaService): void {
  if (!playbackUnlocked) {
    playbackUnlocked = true;
    unlockAudioContextConstructor();
    pendingUnlock.splice(0).forEach((run) => run());
  }
  engine?.resumePlayback?.();
}

export function installMediaPlaybackUnlock(engine: MediaService): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const resume = () => {
    unlockMediaPlaybackNow(engine);
  };
  window.addEventListener('pointerdown', resume, { capture: true });
  window.addEventListener('click', resume, { capture: true });
  window.addEventListener('keydown', resume, { capture: true });
}
