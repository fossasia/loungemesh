import { describe, expect, it } from 'vitest';
import { defaultStageLayout } from '@/stores/sessionFeaturesStore';
import {
  clampStageScale,
  cornerAnchor,
  nearestPipCorner,
  pipSizeForContainer,
  pipStyleForLayout,
  scaleFromResizeDelta,
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
});
