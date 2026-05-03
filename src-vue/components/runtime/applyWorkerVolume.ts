/** Apply a proximity volume update when the participant is known. */
export function applyWorkerVolume(
  id: string,
  volume: number,
  users: Record<string, unknown>,
  patchUser: (id: string, patch: { volume: number }) => void,
  setVolume: (userId: string, gain: number) => void,
): void {
  if (!(id in users)) return;
  patchUser(id, { volume });
  setVolume(id, volume);
}
