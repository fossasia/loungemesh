import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampScale,
  computeRoomBounds,
  defaultScale,
  initialPanCenterOnUser,
  minRoomSize,
  randomInitialUserPosition,
  roomSize,
  spreadInitialUserPosition,
  spheresOverlap,
  worldToRoom,
} from './pan';

describe('pan constants', () => {
  it('randomInitialUserPosition centers in room', () => {
    const pos = randomInitialUserPosition();
    expect(pos.x).toBe(roomSize.x / 2 - 100);
  });

  it('spreadInitialUserPosition avoids overlapping spheres', () => {
    const base = randomInitialUserPosition();
    const next = spreadInitialUserPosition([base]);
    expect(spheresOverlap(base, next)).toBe(false);
    expect(next.x !== base.x || next.y !== base.y).toBe(true);
  });

  it('spheresOverlap detects box intersection', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    expect(spheresOverlap(a, b)).toBe(true);
    expect(spheresOverlap(a, { x: 200, y: 0 })).toBe(false);
  });

  it('uses default bounds when no finite positions are provided', () => {
    const bounds = computeRoomBounds([{ x: Number.NaN, y: 0 }]);
    expect(bounds.size).toEqual(minRoomSize);
    expect(bounds.origin).toEqual({ x: 0, y: 0 });
  });

  it('computeRoomBounds grows with distant positions and only expands', () => {
    const first = computeRoomBounds([{ x: 2900, y: 2900 }]);
    expect(first.size.x).toBeGreaterThanOrEqual(minRoomSize.x);
    const far = computeRoomBounds([{ x: 12000, y: -500 }], first);
    expect(far.size.x).toBeGreaterThan(first.size.x);
    expect(far.origin.x).toBeLessThanOrEqual(first.origin.x);
  });

  it('worldToRoom converts world coordinates to room-local', () => {
    const bounds = { origin: { x: 100, y: 200 }, size: { x: 6000, y: 6000 } };
    expect(worldToRoom({ x: 350, y: 450 }, bounds)).toEqual({ x: 250, y: 250 });
  });

  it('clampScale respects bounds', () => {
    expect(clampScale(0.1)).toBe(0.35);
    expect(clampScale(10)).toBe(2.5);
    expect(clampScale(1)).toBe(1);
  });

  it('clampPan keeps pan inside allowed range', () => {
    const pan = clampPan({ x: 99999, y: -99999 }, defaultScale);
    expect(Number.isFinite(pan.x)).toBe(true);
    expect(Number.isFinite(pan.y)).toBe(true);
  });

  it('clampPan supports expanded room bounds', () => {
    const bounds = computeRoomBounds([
      { x: 0, y: 0 },
      { x: 15000, y: 15000 },
    ]);
    const pan = clampPan({ x: 99999, y: 99999 }, defaultScale, bounds);
    expect(Number.isFinite(pan.x)).toBe(true);
    expect(Number.isFinite(pan.y)).toBe(true);
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
