import type { JitsiTrack } from '@/types/jitsi';

/** Stop the underlying OS media capture (turns off camera/mic LED immediately). */
export function stopTrackStream(track: JitsiTrack): void {
  const stream = (track as unknown as { getOriginalStream?: () => MediaStream }).getOriginalStream?.();
  stream?.getTracks?.().forEach((mediaTrack) => {
    try {
      mediaTrack.stop();
    } catch {
      /* ignore */
    }
  });
}

/** Release a local Jitsi track and stop its underlying MediaStream. */
export function disposeJitsiTrack(track: JitsiTrack | undefined): void {
  if (!track) return;
  stopTrackStream(track);
  try {
    (track as { dispose?: () => void }).dispose?.();
  } catch {
    /* ignore */
  }
}
