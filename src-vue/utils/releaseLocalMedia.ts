import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { stopTrackStream, disposeJitsiTrack } from '@/utils/disposeJitsiTrack';

type ConferenceWithRemove = JitsiConference & {
  removeTrack?: (track: JitsiTrack) => Promise<void>;
};

/**
 * Release local tracks from device capture and signal removal to the conference.
 *
 * Order matters for perceived latency:
 *   1. stopTrackStream  — synchronous; turns the camera/mic LED off immediately
 *   2. conf.removeTrack — async network call to the bridge; does not gate the LED
 *   3. track.dispose    — cleans up the Jitsi wrapper object
 */
export async function releaseLocalMediaTracks(
  tracks: Array<JitsiTrack | undefined>,
  conference?: JitsiConference,
): Promise<void> {
  const conf = conference as ConferenceWithRemove | undefined;
  for (const track of tracks) {
    if (!track) continue;
    // Stop the OS capture immediately so the camera/mic indicator turns off
    // before the async bridge removal round-trip.
    stopTrackStream(track);
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
