/** Effective Web Audio gain — muted participants are always silent. */
export function playbackGainForUser(
  user: { mute: boolean },
  proximityVolume: number,
): number {
  if (user.mute) return 0;
  return Math.max(0, Math.min(1, proximityVolume));
}
