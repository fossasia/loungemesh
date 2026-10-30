import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import type { MediaService } from '@/services/MediaService';
import { useLocalStore } from '@/stores/localStore';
import { releaseLocalMediaTracks } from '@/utils/releaseLocalMedia';
import { nextTick, markRaw } from 'vue';
import { waitForMediaElementDetach } from '@/utils/clearMediaElement';
import { isDesktopShareTrack } from '@/utils/screenshareCapture';
import type { JitsiTrack } from '@/types/jitsi';

function stopAbandonedTracks(tracks: JitsiTrack[]) {
  for (const track of tracks) {
    try {
      track.dispose?.();
      track.getTrack?.()?.stop();
    } catch {
      /* The browser share indicator must not outlive a dropped capture. */
    }
  }
}

export async function stopLocalScreenshare(): Promise<void> {
  const local = useLocalStore();
  const track = local.screenshare;
  const audioTrack = local.screenshareAudio;
  if (!track && !audioTrack) return;
  local.screenshare = undefined;
  local.screenshareAudio = undefined;
  local.screenshareAudioMuted = false;
  const engine = getMediaEngineInstance();
  await nextTick();
  await waitForMediaElementDetach();
  await releaseLocalMediaTracks([track, audioTrack].filter(Boolean) as any[], engine.getConference());
}

export async function startLocalScreenshare(engine: MediaService): Promise<void> {
  const local = useLocalStore();
  const conf = engine.getConference();
  if (!conf) return;
  const tracks = await engine.createLocalTracks(['desktop']);
  const newTrack = tracks.find((t) => t.getType?.() === 'video');
  if (newTrack) newTrack.videoType = 'desktop';
  if (!newTrack || !isDesktopShareTrack(newTrack)) {
    stopAbandonedTracks(tracks);
    return;
  }

  await engine.addLocalTrack(newTrack);
  local.screenshare = markRaw(newTrack);

  const audioTrack = tracks.find((t: any) => t.getType?.() === 'audio');
  if (audioTrack) {
    await engine.addLocalTrack(audioTrack);
    local.screenshareAudio = markRaw(audioTrack);
    local.screenshareAudioMuted = false;
  }
}

export async function toggleLocalScreenshare(engine: MediaService): Promise<void> {
  const local = useLocalStore();
  if (local.screenshare) {
    await stopLocalScreenshare();
  } else {
    await startLocalScreenshare(engine);
  }
}
