import { parseMegaphone } from '@/utils/sessionMegaphone';

/** Effective Web Audio gain — muted participants are always silent. */
export function playbackGainForUser(
  user: { mute?: boolean; properties?: Record<string, unknown> },
  proximityVolume: number,
  isPresenter?: boolean,
): number {
  if (user.mute) return 0;
  if (isPresenter) return 1.0;
  if (parseMegaphone(user.properties?.megaphone)) return 1.0;
  return Math.max(0, Math.min(1, proximityVolume));
}
