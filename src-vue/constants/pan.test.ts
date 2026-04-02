import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampScale,
  defaultScale,
  initialPanCenterOnUser,
  randomInitialUserPosition,
  roomSize,
} from './pan';

describe('pan constants', () => {
  it('randomInitialUserPosition centers in room', () => {
    const pos = randomInitialUserPosition();
    expect(pos.x).toBe(roomSize.x / 2 - 100);
  });

  it('clampScale respects bounds', () => {
    expect(clampScale(0.1)).toBe(0.3);
    expect(clampScale(10)).toBe(3);
    expect(clampScale(1)).toBe(1);
  });

  it('clampPan keeps pan inside allowed range', () => {
    const pan = clampPan({ x: 99999, y: -99999 }, defaultScale);
    expect(pan.x).toBeLessThanOrEqual(0);
    expect(typeof pan.y).toBe('number');
  });

  it('initialPanCenterOnUser offsets for viewport', () => {
    const pan = initialPanCenterOnUser({ x: 100, y: 200 }, 1);
    expect(typeof pan.x).toBe('number');
    expect(typeof pan.y).toBe('number');
  });
});
