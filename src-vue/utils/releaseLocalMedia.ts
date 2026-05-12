import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { stopTrackStream, disposeJitsiTrack } from '@/utils/disposeJitsiTrack';

type ConferenceWithRemove = JitsiConference & {
  removeTrack?: (track: JitsiTrack) => Promise<void>;
};

/**
 * Release local tracks from device capture and signal removal to the conference.
 *
 * Order matters for WebRTC correctness:
 *   1. conf.removeTrack — lets lib-jitsi-meet null out the RTCRtpSender cleanly
 *                         while the MediaStreamTrack is still in a valid state.
 *                         Skipping this (or doing it after stop) leaves a stale
 *                         sender that makes the next addTrack call fail with
 *                         "replace track failed".
 *   2. stopTrackStream  — synchronous; turns the camera/mic LED off.
 *                         Happens ~50-100 ms after the button press (after the
 *                         Jingle round-trip), which is imperceptible to users.
 *   3. track.dispose    — cleans up the Jitsi wrapper object.
 */
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
    // Stop after removal so the sender is already nulled before the OS track ends.
    stopTrackStream(track);
    disposeJitsiTrack(track);
  }
}
