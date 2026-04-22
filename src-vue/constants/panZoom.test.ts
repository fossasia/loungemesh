import { describe, expect, it } from 'vitest';
import { maxScale } from '@/constants/pan';
import { applyZoomStep, panForZoomAtPoint, wheelScaleDelta } from './panZoom';

describe('panZoom', () => {
  it('zooms toward a screen anchor', () => {
    const { pan, scale } = panForZoomAtPoint({ x: 0, y: 0 }, 1, 1.1, 400, 300);
    expect(scale).toBe(1.1);
    expect(pan.x).toBeCloseTo(-40, 0);
    expect(pan.y).toBeCloseTo(-30, 0);
  });

  it('returns unchanged pan when scale is already at the limit', () => {
    const pan = { x: 5, y: 10 };
    const result = panForZoomAtPoint(pan, maxScale, maxScale + 1, 100, 100);
    expect(result).toEqual({ pan, scale: maxScale });
  });

  it('applies zoom steps at anchor', () => {
    const result = applyZoomStep({ x: 10, y: 20 }, 0.65, 0.1, 500, 400);
    expect(result.scale).toBeCloseTo(0.75, 2);
  });

  it('clamps wheel delta per gesture', () => {
    const zoomIn = { deltaY: -5000, deltaMode: 0, ctrlKey: false } as WheelEvent;
    expect(wheelScaleDelta(zoomIn)).toBe(0.05);
    const zoomOut = { deltaY: 5000, deltaMode: 0, ctrlKey: false } as WheelEvent;
    expect(wheelScaleDelta(zoomOut)).toBe(-0.05);
    const lineMode = { deltaY: -10000, deltaMode: 1, ctrlKey: false } as WheelEvent;
    expect(wheelScaleDelta(lineMode)).toBe(0.05);
    const pinch = { deltaY: -10000, deltaMode: 0, ctrlKey: true } as WheelEvent;
    expect(wheelScaleDelta(pinch)).toBe(0.05);
    const pageMode = { deltaY: 10000, deltaMode: 2, ctrlKey: false } as WheelEvent;
    expect(wheelScaleDelta(pageMode)).toBe(-0.05);
  });
});
