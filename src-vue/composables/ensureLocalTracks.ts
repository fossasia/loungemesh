import type { MediaService } from '@/services/MediaService';
import type { JitsiTrack } from '@/types/jitsi';
import type { useLocalStore } from '@/stores/localStore';

type LocalStore = ReturnType<typeof useLocalStore>;

/** Request camera + microphone once; safe to call multiple times. */
export async function ensureLocalTracks(
  local: LocalStore,
  engine: MediaService,
): Promise<JitsiTrack[]> {
  if (local.audio && local.video) {
    return [local.audio, local.video].filter(Boolean) as JitsiTrack[];
  }
  const tracks = await engine.createLocalTracks(['audio', 'video']);
  local.setLocalTracks(tracks);
  return tracks;
}
