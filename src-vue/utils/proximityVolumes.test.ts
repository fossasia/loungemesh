import { describe, expect, it } from 'vitest';
import { computeProximityVolumes } from './proximityVolumes';

describe('computeProximityVolumes', () => {
  it('returns full volume at same position', () => {
    const pos = { x: 100, y: 100 };
    expect(computeProximityVolumes(pos, [{ id: 'a', pos }])).toEqual([
      { id: 'a', volume: 1 },
    ]);
  });

  it('returns zero volume beyond audio radius', () => {
    const myPos = { x: 0, y: 0 };
    const far = { x: 5000, y: 5000 };
    const [row] = computeProximityVolumes(myPos, [{ id: 'b', pos: far }]);
    expect(row.volume).toBe(0);
  });
});
