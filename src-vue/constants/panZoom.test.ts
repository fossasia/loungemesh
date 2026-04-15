import { describe, expect, it } from 'vitest';
import { maxScale } from '@/constants/pan';
import { applyZoomStep, panForZoomAtPoint } from './panZoom';

describe('panZoom', () => {
  it('zooms toward a screen anchor', () => {
    const { pan, scale } = panForZoomAtPoint({ x: 0, y: 0 }, 1, 1.5, 400, 300);
    expect(scale).toBe(1.5);
    expect(pan.x).toBeCloseTo(-200, 0);
    expect(pan.y).toBeCloseTo(-150, 0);
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
});
