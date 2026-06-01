import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { logMediaStateSnapshot, type MediaUserRow } from '@/utils/mediaDebug';

/** Log current conference media state (no-op unless media debug is enabled). */
export function emitMediaStateSnapshot(reason: string): void {
  const conference = useConferenceStore();
  const local = useLocalStore();
  const users: MediaUserRow[] = Object.entries(conference.users).map(([id, u]) => ({
    id,
    mute: u.mute,
    hasVideo: !!u.video,
    videoMuted: u.video?.isMuted?.(),
    videoType: u.videoType,
    hasAudio: !!u.audio,
  }));
  logMediaStateSnapshot({
    reason,
    joined: conference.isJoined,
    localId: local.id,
    cameraOff: local.cameraOff,
    hasLocalVideo: !!local.video,
    localVideoMuted: local.video?.isMuted?.(),
    users,
    visibleUserIds: local.visibleUsers,
    usersOnStage: local.usersOnStage,
  });
}
