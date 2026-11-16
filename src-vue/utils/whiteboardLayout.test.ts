import { describe, expect, it } from 'vitest';
import {
  clampWhiteboardOffset,
  clampWhiteboardScale,
  scaleFromResizeDelta,
  whiteboardOverlayBox,
} from './whiteboardLayout';

describe('whiteboardLayout', () => {
  it('clamps scale to configured bounds', () => {
    expect(clampWhiteboardScale(0.1)).toBe(0.35);
    expect(clampWhiteboardScale(1.5)).toBe(1);
    expect(clampWhiteboardScale(0.6)).toBe(0.6);
  });

  it('applies uniform resize delta from pointer movement', () => {
    expect(scaleFromResizeDelta(0.5, 200, 160, 1000, 800)).toBeCloseTo(0.7);
    expect(scaleFromResizeDelta(0.5, -200, -200, 1000, 800)).toBe(0.35);
    expect(scaleFromResizeDelta(1, 100, 0, 1000, 800)).toBe(1);
  });

  it('clamps drag offset within the shell', () => {
    expect(clampWhiteboardOffset({ x: 200, y: -200 }, 1000, 800, 0.8)).toEqual({
      x: 100,
      y: -80,
    });
  });

  it('positions the overlay from scale and offset', () => {
    expect(whiteboardOverlayBox(1000, 800, 0.8, { x: 40, y: -20 })).toEqual({
      position: 'absolute',
      width: '800px',
      height: '640px',
      left: '140px',
      top: '60px',
    });
    expect(whiteboardOverlayBox(0, 0, 1, { x: 0, y: 0 })).toEqual({});
  });

  it('ignores resize deltas when the shell has no size', () => {
    expect(scaleFromResizeDelta(0.6, 40, 40, 0, 800)).toBe(0.6);
    expect(scaleFromResizeDelta(0.6, 40, 40, 1000, 0)).toBe(0.6);
  });
});
