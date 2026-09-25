import type { MediaService } from '@/services/MediaService';
import type { JitsiTrack } from '@/types/jitsi';
import { createTrackDeviceOpts } from '@/utils/mediaDevicePrefs';

/** createLocalTracks with stored device ids, omitting opts when none are set. */
export async function createPreferredLocalTracks(
  engine: Pick<MediaService, 'createLocalTracks'>,
  devices: Array<'audio' | 'video' | 'desktop'>,
): Promise<JitsiTrack[]> {
  const opts = createTrackDeviceOpts(devices);
  if (!opts) return engine.createLocalTracks(devices);
  return engine.createLocalTracks(devices, opts);
}
