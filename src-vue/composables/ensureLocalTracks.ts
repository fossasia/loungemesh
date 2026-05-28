import type { MediaService } from '@/services/MediaService';
import type { JitsiTrack } from '@/types/jitsi';
import type { useLocalStore } from '@/stores/localStore';
import { disposeJitsiTrack } from '@/utils/disposeJitsiTrack';
import { mediaDebug } from '@/utils/mediaDebug';

type LocalStore = ReturnType<typeof useLocalStore>;

/** Request only the devices currently enabled in UI state; safe to call multiple times. */
export async function ensureLocalTracks(
  local: LocalStore,
  engine: MediaService,
): Promise<JitsiTrack[]> {
  const existing = [local.audio, local.video].filter(Boolean) as JitsiTrack[];
  const devices: ('audio' | 'video')[] = [];
  if (!local.mute && !local.audio) devices.push('audio');
  if (!local.cameraOff && !local.video) devices.push('video');
  if (!devices.length) return existing;
  const tracks = await engine.createLocalTracks(devices);
  const merged = [...existing];
  const used = new Set<JitsiTrack>();
  for (const track of tracks) {
    if (track.getType?.() === 'audio' && !local.audio) {
      merged.push(track);
      used.add(track);
    }
    if (track.getType?.() === 'video' && !local.video && !local.cameraOff) {
      merged.push(track);
      used.add(track);
    }
  }
  for (const track of tracks) {
    if (!used.has(track)) disposeJitsiTrack(track);
  }
  local.setLocalTracks(merged);
  mediaDebug('ensureLocalTracks', 'created', {
    devices,
    audio: !!local.audio,
    video: !!local.video,
    cameraOff: local.cameraOff,
    videoMuted: local.video?.isMuted?.(),
  });
  return merged;
}
