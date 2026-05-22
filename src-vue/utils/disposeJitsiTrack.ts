import type { JitsiTrack } from '@/types/jitsi';

type RawTrackHolder = {
  getTrack?: () => MediaStreamTrack | null;
  getStream?: () => MediaStream | null;
  getOriginalStream?: () => MediaStream | null;
  track?: MediaStreamTrack | null;
  stream?: MediaStream | null;
};

/**
 * Collect the raw OS-level MediaStreamTracks backing a Jitsi track.
 *
 * MUST be called BEFORE removeTrack()/dispose(): lib-jitsi-meet nulls its
 * internal `stream`/`track` pointers during disposal, so reading them afterwards
 * returns nothing — and the real camera/mic handle would never get .stop(),
 * leaving the device LED on.
 */
export function collectMediaStreamTracks(track: JitsiTrack | undefined): MediaStreamTrack[] {
  if (!track) return [];
  const holder = track as unknown as RawTrackHolder;
  const result = new Set<MediaStreamTrack>();
  try {
    const single = holder.getTrack?.();
    if (single) result.add(single);
  } catch {
    /* ignore */
  }
  try {
    holder.getOriginalStream?.()?.getTracks?.().forEach((t) => result.add(t));
  } catch {
    /* ignore */
  }
  try {
    holder.getStream?.()?.getTracks?.().forEach((t) => result.add(t));
  } catch {
    /* ignore */
  }
  if (holder.track) result.add(holder.track);
  try {
    holder.stream?.getTracks?.().forEach((t) => result.add(t));
  } catch {
    /* ignore */
  }
  return [...result];
}

/** Stop raw OS media capture (turns the camera/mic LED off immediately). */
export function stopMediaStreamTracks(mediaTracks: MediaStreamTrack[]): void {
  for (const mediaTrack of mediaTracks) {
    try {
      mediaTrack.stop();
    } catch {
      /* ignore */
    }
  }
}

/** Stop the underlying OS media capture for a Jitsi track. */
export function stopTrackStream(track: JitsiTrack): void {
  stopMediaStreamTracks(collectMediaStreamTracks(track));
}

/** Release a local Jitsi track and stop its underlying MediaStream. */
export function disposeJitsiTrack(track: JitsiTrack | undefined): void {
  if (!track) return;
  // Capture the device handles first — dispose() nulls them internally.
  const rawTracks = collectMediaStreamTracks(track);
  try {
    void (track as { dispose?: () => unknown }).dispose?.();
  } catch {
    /* ignore */
  }
  // Stop after dispose as well: dispose() is async in lib-jitsi-meet and may not
  // have stopped the device track yet (or at all if it threw).
  stopMediaStreamTracks(rawTracks);
}
