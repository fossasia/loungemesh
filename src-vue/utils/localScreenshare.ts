import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { releaseLocalMediaTracks } from '@/utils/releaseLocalMedia';

/** Stop the local screenshare track if one is active. */
export async function stopLocalScreenshare(): Promise<void> {
  const local = useLocalStore();
  const track = local.screenshare;
  if (!track) return;
  local.screenshare = undefined;
  const engine = getMediaEngineInstance();
  await releaseLocalMediaTracks([track], engine.getConference());
}
