import type { MediaService } from '@/services/MediaService';
import type { JitsiTrack } from '@/types/jitsi';
import type { useLocalStore } from '@/stores/localStore';
import { mediaDebug } from '@/utils/mediaDebug';

type LocalStore = ReturnType<typeof useLocalStore>;

/** Request camera + microphone once; safe to call multiple times. */
export async function ensureLocalTracks(
  local: LocalStore,
  engine: MediaService,
): Promise<JitsiTrack[]> {
  const existing = [local.audio, local.video].filter(Boolean) as JitsiTrack[];
  const devices: ('audio' | 'video')[] = [];
  if (!local.audio) devices.push('audio');
  if (!local.cameraOff && !local.video) devices.push('video');
  if (!devices.length) return existing;
  const tracks = await engine.createLocalTracks(devices);
  const merged = [...existing];
  for (const track of tracks) {
    if (track.getType?.() === 'audio' && !local.audio) merged.push(track);
    if (track.getType?.() === 'video' && !local.video && !local.cameraOff) merged.push(track);
  }
  local.setLocalTracks(merged);
  mediaDebug('ensureLocalTracks', 'created', {
    devices,
    audio: !!local.audio,
    video: !!local.video,
    cameraOff: local.cameraOff,
    videoMuted: local.video?.isMuted?.(),
  });
  if (local.mute && local.audio?.isMuted?.() === false) {
    try {
      await local.audio.mute();
    } catch {
      /* ignore */
    }
  }
  return merged;
}
