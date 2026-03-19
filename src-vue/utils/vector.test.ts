import { describe, expect, it } from 'vitest';
import { getVectorDistance, getVolumeByDistance } from './vector';

describe('vector', () => {
  it('computes distance', () => {
    expect(getVectorDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('maps volume by distance', () => {
    const v = getVolumeByDistance({ x: 0, y: 0 }, { x: 0, y: 0 });
    expect(v).toBe(1);
  });
});
