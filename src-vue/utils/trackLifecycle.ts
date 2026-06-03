import type { JitsiTrack } from '@/types/jitsi';

function videoTrackFromJitsi(track: JitsiTrack): MediaStreamTrack | undefined {
  const stream = (track as unknown as { getOriginalStream?: () => MediaStream }).getOriginalStream?.();
  return stream?.getVideoTracks?.()?.[0];
}

/** Run callback when the underlying camera/desktop MediaStream track ends (browser stop share). */
export function onVideoTrackEnded(track: JitsiTrack, onEnd: () => void): () => void {
  const vt = videoTrackFromJitsi(track);
  if (!vt) return () => {};
  const handler = () => onEnd();
  vt.addEventListener('ended', handler);
  return () => vt.removeEventListener('ended', handler);
}
