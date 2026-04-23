import type { MediaService } from '@/services/MediaService';
import { disposeJitsiTrack } from '@/utils/disposeJitsiTrack';
import type { useLocalStore } from '@/stores/localStore';

type LocalStore = ReturnType<typeof useLocalStore>;

/** Switch back from desktop share to camera after the user stops sharing in the browser UI. */
export async function restoreCameraVideo(
  engine: MediaService,
  local: LocalStore,
): Promise<void> {
  const conf = engine.getConference();
  if (!conf) return;

  const oldTrack = conf.getLocalVideoTrack?.();
  if (oldTrack?.videoType !== 'desktop') {
    local.videoType = 'camera';
    return;
  }

  if (local.cameraOff) {
    disposeJitsiTrack(oldTrack);
    local.video = undefined;
    local.videoType = 'camera';
    return;
  }

  try {
    const tracks = await engine.createLocalTracks(['video']);
    const camera = tracks.find((t) => t.getType?.() === 'video') ?? tracks[0];
    if (!camera) return;

    await engine.replaceLocalTrack(oldTrack, camera);
    disposeJitsiTrack(oldTrack);

    const list = [];
    if (local.audio) list.push(local.audio);
    list.push(camera);
    local.setLocalTracks(list);
  } catch {
    local.video = undefined;
    local.videoType = 'camera';
  }
}
