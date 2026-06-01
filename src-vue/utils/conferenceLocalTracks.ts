import type { JitsiConference, JitsiTrack } from '@/types/jitsi';

type ConferenceWithLocalTracks = JitsiConference & {
  getLocalTracks?: () => JitsiTrack[];
};

export function getConferenceLocalTracks(conference: JitsiConference): JitsiTrack[] {
  return (conference as ConferenceWithLocalTracks).getLocalTracks?.() ?? [];
}

/** Add or replace a local track on the conference without duplicate addTrack calls. */
export async function publishLocalTrackToConference(
  conference: JitsiConference,
  track: JitsiTrack,
  add: (t: JitsiTrack) => Promise<void>,
  replace: (oldTrack: JitsiTrack, nextTrack: JitsiTrack) => Promise<void>,
): Promise<'added' | 'replaced' | 'skipped'> {
  const local = getConferenceLocalTracks(conference);
  if (local.some((t) => t === track)) return 'skipped';

  const sameKind = local.find((t) => t.getType() === track.getType());
  if (sameKind) {
    await replace(sameKind, track);
    return 'replaced';
  }

  await add(track);
  return 'added';
}
