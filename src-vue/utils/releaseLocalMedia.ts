import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { disposeJitsiTrack } from '@/utils/disposeJitsiTrack';

type ConferenceWithRemove = JitsiConference & {
  removeTrack?: (track: JitsiTrack) => Promise<void>;
};

/** Detach local tracks from the conference (if any) and release device capture. */
export function releaseLocalMediaTracks(
  tracks: Array<JitsiTrack | undefined>,
  conference?: JitsiConference,
): void {
  const conf = conference as ConferenceWithRemove | undefined;
  for (const track of tracks) {
    if (!track) continue;
    if (conf?.removeTrack) {
      void conf.removeTrack(track).catch(() => {
        /* track may already be gone */
      });
    }
    disposeJitsiTrack(track);
  }
}
