export type Vector2 = { x: number; y: number };

export const audioRadius = 650;

export function getVectorDistance(p1: Vector2, p2: Vector2): number {
  const a = p1.x - p2.x;
  const b = p1.y - p2.y;
  return Math.sqrt(a * a + b * b);
}

export function mapVolumeToDist(max: number, dist: number): number {
  const volume = 1 - dist / max;
  return volume > 0 ? volume : 0;
}

export function getVolumeByDistance(p1: Vector2, p2: Vector2): number {
  const d = getVectorDistance(p1, p2);
  return mapVolumeToDist(audioRadius, d);
}

export function isOnScreen(pos: Vector2, width: number, height: number): boolean {
  return pos.x > -width && pos.x < window.innerWidth && pos.y > -height && pos.y < window.innerHeight;
}

