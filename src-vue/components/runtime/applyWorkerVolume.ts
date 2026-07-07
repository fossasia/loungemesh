import { playbackGainForUser } from '@/utils/participantPlaybackGain';

export type ProximityUser = { mute: boolean };

/** Apply a proximity volume update when the participant is known. */
export function applyWorkerVolume(
  id: string,
  volume: number,
  users: Record<string, ProximityUser>,
  patchUser: (id: string, patch: { volume: number }) => void,
  setVolume: (userId: string, gain: number) => void,
  isPresenter?: boolean,
): void {
  const user = users[id];
  if (!user) return;
  patchUser(id, { volume });
  setVolume(id, playbackGainForUser(user, volume, isPresenter));
}
