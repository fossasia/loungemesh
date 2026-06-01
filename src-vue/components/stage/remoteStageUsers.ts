import type { JitsiTrackLike } from '@/types/jitsi';
import { isOnStage } from '@/components/stage/isOnStage';

export type RemoteStageUser = {
  id: string;
  audio?: JitsiTrackLike;
  video?: JitsiTrackLike;
};

export type RemoteStageUserSource = {
  audio?: JitsiTrackLike;
  video?: JitsiTrackLike;
  properties?: { onStage?: unknown };
};

/** Remote participants that should appear on the stage strip. */
export function remoteStageUsers(users: Record<string, RemoteStageUserSource | undefined>): RemoteStageUser[] {
  const out: RemoteStageUser[] = [];
  for (const id of Object.keys(users)) {
    const user = users[id];
    if (user && isOnStage(user.properties?.onStage)) {
      out.push({ id, audio: user.audio, video: user.video });
    }
  }
  return out;
}
