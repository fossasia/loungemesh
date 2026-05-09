import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { disposeJitsiTrack } from '@/utils/disposeJitsiTrack';

type ConferenceWithRemove = JitsiConference & {
  removeTrack?: (track: JitsiTrack) => Promise<void>;
};

/** Detach local tracks from the conference (if any) and release device capture. */
export async function releaseLocalMediaTracks(
  tracks: Array<JitsiTrack | undefined>,
  conference?: JitsiConference,
): Promise<void> {
  const conf = conference as ConferenceWithRemove | undefined;
  for (const track of tracks) {
    if (!track) continue;
    if (conf?.removeTrack) {
      try {
        await conf.removeTrack(track);
      } catch {
        /* bridge down or track already removed */
      }
    }
    disposeJitsiTrack(track);
  }
}
