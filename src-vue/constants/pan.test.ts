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

  it('initialPanCenterOnUser centers avatar in visible viewport', () => {
    const userPos = { x: roomSize.x / 2 - 100, y: roomSize.y / 2 - 100 };
    const pan = initialPanCenterOnUser(userPos, defaultScale);
    const centerX =
      pan.x + (userPos.x + 100) * defaultScale;
    const centerY =
      pan.y + (userPos.y + 100) * defaultScale;
    expect(centerX).toBeCloseTo(window.innerWidth / 2, 0);
    expect(centerY).toBeGreaterThan(0);
    expect(centerY).toBeLessThan(window.innerHeight);
  });
});
