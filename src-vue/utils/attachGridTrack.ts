import type { JitsiTrack } from '@/types/jitsi';
import { clearMediaElement } from '@/utils/clearMediaElement';

/** Attach a camera track to a grid tile, or clear the element when none is set. */
export function attachGridTrack(
  el: HTMLVideoElement | null,
  track: JitsiTrack | undefined,
): void {
  if (!el) return;
  clearMediaElement(el);
  if (!track) return;
  track.attach?.(el);
}

export function detachGridTrack(
  el: HTMLVideoElement | null,
  track: JitsiTrack | undefined,
): void {
  if (track && el) {
    try {
      track.detach?.(el);
    } catch {
      /* already detached */
    }
  }
  clearMediaElement(el);
}
