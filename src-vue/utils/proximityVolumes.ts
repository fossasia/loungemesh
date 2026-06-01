import { getVolumeByDistance, type Vector2 } from '@/utils/vector';

export type ProximityUser = { id: string; pos: Vector2 };

export function computeProximityVolumes(
  myPos: Vector2,
  users: ProximityUser[],
): Array<{ id: string; volume: number }> {
  return users.map(({ id, pos }) => ({
    id,
    volume: getVolumeByDistance(myPos, pos),
  }));
}
