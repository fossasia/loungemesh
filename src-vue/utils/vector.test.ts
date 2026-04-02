import { describe, expect, it } from 'vitest';
import { getVectorDistance, getVolumeByDistance, isOnScreen, mapVolumeToDist } from './vector';

describe('vector', () => {
  it('computes distance', () => {
    expect(getVectorDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('maps volume by distance', () => {
    const v = getVolumeByDistance({ x: 0, y: 0 }, { x: 0, y: 0 });
    expect(v).toBe(1);
  });

  it('mapVolumeToDist clamps negative volume to zero', () => {
    expect(mapVolumeToDist(100, 200)).toBe(0);
  });

  it('isOnScreen detects visible rectangles', () => {
    expect(isOnScreen({ x: 10, y: 10 }, 50, 50)).toBe(true);
    expect(isOnScreen({ x: -500, y: 10 }, 50, 50)).toBe(false);
  });
});
