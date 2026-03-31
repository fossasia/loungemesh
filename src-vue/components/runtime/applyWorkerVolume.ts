export type VolumeUser = { volume: number };

/** Apply a proximity volume update when the participant is known. */
export function applyWorkerVolume(
  id: string,
  volume: number,
  users: Record<string, VolumeUser | undefined>,
  setVolume: (userId: string, gain: number) => void,
): void {
  if (!users[id]) return;
  users[id]!.volume = volume;
  setVolume(id, volume);
}
