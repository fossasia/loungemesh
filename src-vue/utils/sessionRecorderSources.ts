import type { JitsiTrack } from '@/types/jitsi';
import { collectMediaStreamTracks } from '@/utils/disposeJitsiTrack';
import type { SessionRecorderSources } from '@/composables/useSessionRecorder';

type LocalAudioSource = { audio?: JitsiTrack };
type UsersSource = { users: Record<string, { audio?: JitsiTrack } | undefined> };

/** Live video tiles currently rendered in the session. */
export function collectSessionVideoElements(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll<HTMLVideoElement>('.sessionRoot video'));
}

/** Every audio MediaStreamTrack in the room (local mic + remote participants). */
export function collectSessionAudioTracks(
  local: LocalAudioSource,
  conference: UsersSource,
): MediaStreamTrack[] {
  const tracks = collectMediaStreamTracks(local.audio).filter((t) => t.kind === 'audio');
  for (const id of Object.keys(conference.users)) {
    const remote = conference.users[id]?.audio;
    tracks.push(...collectMediaStreamTracks(remote).filter((t) => t.kind === 'audio'));
  }
  return tracks;
}

/** Build recorder sources bound to the live local + conference stores. */
export function makeRecorderSources(
  local: LocalAudioSource,
  conference: UsersSource,
): SessionRecorderSources {
  return {
    getVideoElements: collectSessionVideoElements,
    getAudioTracks: () => collectSessionAudioTracks(local, conference),
  };
}
