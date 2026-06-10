import { describe, expect, it } from 'vitest';
import {
  hexToHsv,
  hsvToHex,
  hueFromWheelEvent,
  hueMarkerPosition,
  normalizeHex,
  svFromBoxEvent,
} from './whiteboardColor';

describe('whiteboardColor', () => {
  it('normalizes hex codes', () => {
    expect(normalizeHex('#AbC123')).toBe('#abc123');
    expect(normalizeHex('f00')).toBe('#ff0000');
    expect(normalizeHex('not-a-color')).toBeNull();
    expect(normalizeHex('ab')).toBeNull();
  });

  it('round-trips hsv and hex', () => {
    const hex = hsvToHex(220, 80, 55);
    const hsv = hexToHsv(hex);
    expect(hsv?.h).toBeCloseTo(220, 0);
    expect(hsv?.s).toBeCloseTo(80, 0);
    expect(hsv?.v).toBeCloseTo(55, 0);
  });

  it('covers hsv conversion sectors and achromatic colors', () => {
    for (const hue of [15, 75, 135, 195, 255, 315]) {
      expect(hexToHsv(hsvToHex(hue, 90, 80))?.h).toBeCloseTo(hue, 0);
    }
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#ff0000')?.h).toBeCloseTo(0, 0);
    expect(hexToHsv('#00ff00')?.h).toBeCloseTo(120, 0);
    expect(hexToHsv('#0000ff')?.h).toBeCloseTo(240, 0);
  });

  it('maps wheel and box pointer positions', () => {
    const wheel = {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    } as DOMRect;
    expect(hueFromWheelEvent(wheel, 50, 10)).toBeCloseTo(0, 0);
    expect(hueFromWheelEvent(wheel, 22, 22)).toBeCloseTo(315, 0);
    expect(hueFromWheelEvent(wheel, 50, 50)).toBeNull();
    expect(hueFromWheelEvent(wheel, 50, 48)).toBeNull();
    const box = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
    expect(svFromBoxEvent(box, 100, 0)).toEqual({ s: 100, v: 100 });
    expect(svFromBoxEvent(box, 0, 100)).toEqual({ s: 0, v: 0 });
  });

  it('positions the hue marker on the ring', () => {
    expect(hueMarkerPosition(0).top).toBe('8.5%');
    expect(hueMarkerPosition(180).top).toBe('91.5%');
  });
});
