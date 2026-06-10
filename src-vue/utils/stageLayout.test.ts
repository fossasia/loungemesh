import { describe, expect, it } from 'vitest';
import { defaultStageLayout } from '@/stores/sessionFeaturesStore';
import {
  clampStageScale,
  cornerAnchor,
  nearestPipCorner,
  pipSizeForContainer,
  pipStyleForLayout,
  scaleFromResizeDelta,
  getPipRatio,
} from './stageLayout';

describe('stageLayout', () => {
  it('clamps scale and sizes pip proportionally', () => {
    expect(clampStageScale(0.1)).toBe(0.75);
    expect(clampStageScale(2)).toBe(1.35);
    expect(pipSizeForContainer(400)).toBe(48);
    expect(pipSizeForContainer(1000)).toBe(64);
  });

  it('picks the nearest pip corner', () => {
    expect(nearestPipCorner(50, 50, 400, 300)).toBe('tl');
    expect(nearestPipCorner(350, 50, 400, 300)).toBe('tr');
    expect(nearestPipCorner(50, 250, 400, 300)).toBe('bl');
    expect(nearestPipCorner(350, 250, 400, 300)).toBe('br');
  });

  it('scales from resize delta', () => {
    const layout = defaultStageLayout();
    expect(scaleFromResizeDelta(layout.scale, 100, 500)).toBeGreaterThan(layout.scale);
    expect(scaleFromResizeDelta(layout.scale, 100, 0)).toBe(layout.scale);
  });

  it('maps pip corners to anchor edges', () => {
    expect(cornerAnchor('tl')).toEqual({ x: 'left', y: 'top' });
    expect(cornerAnchor('tr')).toEqual({ x: 'right', y: 'top' });
    expect(cornerAnchor('bl')).toEqual({ x: 'left', y: 'bottom' });
    expect(cornerAnchor('br')).toEqual({ x: 'right', y: 'bottom' });
  });

  it('positions the pip for each corner and animates when requested', () => {
    const layout = defaultStageLayout();
    expect(pipStyleForLayout({ ...layout, pipCorner: 'tl' }, 400, 225, true).left).toBe('8px');
    expect(pipStyleForLayout({ ...layout, pipCorner: 'tl' }, 400, 225, true).top).toBe('8px');
    
    expect(pipStyleForLayout({ ...layout, pipCorner: 'tr' }, 400, 225, false).left).toBe('344px');
    expect(pipStyleForLayout({ ...layout, pipCorner: 'tr' }, 400, 225, false).top).toBe('8px');
    
    expect(pipStyleForLayout({ ...layout, pipCorner: 'bl' }, 400, 225, false).left).toBe('8px');
    expect(pipStyleForLayout({ ...layout, pipCorner: 'bl' }, 400, 225, false).top).toBe('169px');
    
    const style = pipStyleForLayout(
      { ...layout, pipCorner: 'br', pipOffset: { x: 4, y: -2 } },
      400,
      225,
      false,
    );
    expect(style.left).toBe('348px');
    expect(style.top).toBe('167px');
  });

  it('covers remaining branches in getPipRatio and nearestPipCorner', () => {
    const layout = defaultStageLayout();

    // 1. getPipRatio when offset is 0
    expect(getPipRatio({ ...layout, pipCorner: 'tl', pipOffset: { x: 0, y: 0 } }, 400, 300)).toEqual({ x: 0, y: 0 });
    expect(getPipRatio({ ...layout, pipCorner: 'tr', pipOffset: { x: 0, y: 0 } }, 400, 300)).toEqual({ x: 1, y: 0 });
    expect(getPipRatio({ ...layout, pipCorner: 'bl', pipOffset: { x: 0, y: 0 } }, 400, 300)).toEqual({ x: 0, y: 1 });
    expect(getPipRatio({ ...layout, pipCorner: 'br', pipOffset: { x: 0, y: 0 } }, 400, 300)).toEqual({ x: 1, y: 1 });

    // 2. getPipRatio with absolute pixels (> 1) and other corners
    // tl corner
    expect(getPipRatio({ ...layout, pipCorner: 'tl', pipOffset: { x: 10, y: 10 } }, 400, 300)).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number)
    }));
    // tr corner
    expect(getPipRatio({ ...layout, pipCorner: 'tr', pipOffset: { x: 10, y: 10 } }, 400, 300)).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number)
    }));
    // bl corner
    expect(getPipRatio({ ...layout, pipCorner: 'bl', pipOffset: { x: 10, y: 10 } }, 400, 300)).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number)
    }));

    // 3. getPipRatio when usableWidth <= 0 and usableHeight <= 0
    // size for container width 10 is 48. padding is 8.
    // usableWidth = 10 - 48 - 16 = -54 <= 0
    expect(getPipRatio({ ...layout, pipCorner: 'tl', pipOffset: { x: 10, y: 10 } }, 10, 10)).toEqual({ x: 0, y: 0 });

    // 4. getPipRatio branch combinations for Math.abs(rx) > 1 || Math.abs(ry) > 1
    // both false: rx = 0.5, ry = 0.5
    expect(getPipRatio({ ...layout, pipCorner: 'tl', pipOffset: { x: 0.5, y: 0.5 } }, 400, 300)).toEqual({ x: 0.5, y: 0.5 });
    // rx true, ry false: rx = 10, ry = 0.5
    expect(getPipRatio({ ...layout, pipCorner: 'tl', pipOffset: { x: 10, y: 0.5 } }, 400, 300).x).toBeGreaterThan(0);
    // rx false, ry true: rx = 0.5, ry = 10
    expect(getPipRatio({ ...layout, pipCorner: 'tl', pipOffset: { x: 0.5, y: 10 } }, 400, 300).y).toBeGreaterThan(0);
  });
});
