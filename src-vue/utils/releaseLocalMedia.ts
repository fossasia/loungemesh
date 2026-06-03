import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { collectMediaStreamTracks, stopMediaStreamTracks } from '@/utils/disposeJitsiTrack';

/** Capture device handles before UI detach can clear Jitsi stream pointers. */
export function collectTracksForRelease(tracks: Array<JitsiTrack | undefined>): MediaStreamTrack[] {
  const raw = new Set<MediaStreamTrack>();
  for (const track of tracks) {
    collectMediaStreamTracks(track).forEach((mediaTrack) => raw.add(mediaTrack));
  }
  return [...raw];
}

type ConferenceWithRemove = JitsiConference & {
  removeTrack?: (track: JitsiTrack) => Promise<void>;
};

/**
 * Release local tracks: remove them from the conference, dispose the Jitsi
 * wrapper, and stop the underlying OS capture so the camera/mic LED turns off.
 *
 * Why this exact order matters:
 *   1. Capture the raw MediaStreamTracks FIRST. lib-jitsi-meet nulls its internal
 *      `stream`/`track` pointers during removeTrack()/dispose(), so we must grab
 *      the real device handles before they vanish.
 *   2. conf.removeTrack — lets lib-jitsi-meet null out the RTCRtpSender cleanly
 *      while the JitsiLocalTrack is still valid. Stopping the device track before
 *      this would leave a stale sender and break the next addTrack ("replace
 *      track failed").
 *   3. track.dispose — tears down the Jitsi wrapper (async in lib-jitsi-meet).
 *   4. Stop the captured device tracks LAST — guarantees the LED goes off even if
 *      removeTrack/dispose already cleared the lib's own stream reference.
 */
export async function releaseLocalMediaTracks(
  tracks: Array<JitsiTrack | undefined>,
  conference?: JitsiConference,
): Promise<void> {
  const conf = conference as ConferenceWithRemove | undefined;
  for (const track of tracks) {
    if (!track) continue;
    const rawTracks = collectMediaStreamTracks(track);
    try {
      if (conf?.removeTrack) {
        await conf.removeTrack(track);
      }
    } catch {
      /* bridge down or track already removed */
    }
    try {
      await (track as { dispose?: () => unknown }).dispose?.();
    } catch {
      /* already disposed */
    }
    // Stop the real device tracks we captured up front — bulletproof LED-off.
    stopMediaStreamTracks(rawTracks);
  }
}
