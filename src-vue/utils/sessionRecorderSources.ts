import type { JitsiTrack } from '@/types/jitsi';
import { collectMediaStreamTracks } from '@/utils/disposeJitsiTrack';
import type { RecordingVideoSource, SessionRecorderSources } from '@/composables/useSessionRecorder';

type LocalAudioSource = { audio?: JitsiTrack };
type UsersSource = { users: Record<string, { audio?: JitsiTrack } | undefined> };

export function collectSessionVideoSources(): RecordingVideoSource[] {
  return Array.from(document.querySelectorAll<HTMLVideoElement>('.sessionRoot .userContainer video'))
    .map((element, index) => {
      const container = element.closest<HTMLElement>('.userContainer')!;
      const participantId = container.dataset.recordingParticipant || container.id || `participant-${index + 1}`;
      const displayName =
        container.dataset.recordingName ||
        container.querySelector<HTMLElement>('.nameText')?.textContent?.trim() ||
        container.querySelector<HTMLElement>('.nameTag')?.textContent?.trim() ||
        participantId;
      return { element, participantId, displayName };
    });
}

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
    getVideoSources: collectSessionVideoSources,
    getAudioTracks: () => collectSessionAudioTracks(local, conference),
  };
}
