import type { JitsiTrack } from '@/types/jitsi';
import { onVideoTrackEnded } from '@/utils/trackLifecycle';

/** Bind cleanup when the browser stops a desktop capture track. */
export function bindScreenshareEndWatch(
  track: JitsiTrack | undefined,
  onEnd: () => void,
): () => void {
  if (!track || track.videoType !== 'desktop') return () => {};
  return onVideoTrackEnded(track, onEnd);
}
