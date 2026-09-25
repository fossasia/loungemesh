import { getVolumeByDistance, type Vector2 } from '@/utils/vector';
import { parseMegaphone } from '@/utils/sessionMegaphone';

export type SphereGridCandidate = {
  id: string;
  pos: Vector2;
  properties?: Record<string, unknown>;
  displayName?: string;
};

export function isInHearingSphere(
  myPos: Vector2,
  candidate: SphereGridCandidate,
  opts?: { presenterId?: string },
): boolean {
  if (opts?.presenterId && candidate.id === opts.presenterId) return true;
  if (parseMegaphone(candidate.properties?.megaphone)) return true;
  return getVolumeByDistance(myPos, candidate.pos) > 0;
}

export type SphereGridMember = {
  id: string;
  displayName: string;
  isLocal: boolean;
};

/** Local user plus remotes currently in hearing range (or megaphone / stage). */
export function sphereGridMembers(
  myPos: Vector2,
  localId: string,
  localName: string,
  remotes: SphereGridCandidate[],
  opts?: { presenterId?: string },
): SphereGridMember[] {
  const local: SphereGridMember = {
    id: localId || 'local',
    displayName: localName || 'You',
    isLocal: true,
  };
  const others = remotes
    .filter((candidate) => isInHearingSphere(myPos, candidate, opts))
    .map((candidate) => ({
      id: candidate.id,
      displayName: candidate.displayName || 'Participant',
      isLocal: false,
    }));
  return [local, ...others];
}
