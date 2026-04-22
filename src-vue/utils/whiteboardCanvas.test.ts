import { describe, expect, it, vi } from 'vitest';
import {
  clientToCanvasPoint,
  drawStrokeOnContext,
  renderWhiteboard,
} from './whiteboardCanvas';

describe('whiteboardCanvas', () => {
  it('returns null without a canvas element', () => {
    expect(clientToCanvasPoint(null, 1, 2)).toBeNull();
  });

  it('maps client coordinates into canvas space', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 150,
      height: 100,
    } as DOMRect);
    expect(clientToCanvasPoint(canvas, 25, 40)).toEqual({ x: 30, y: 40 });
  });

  it('skips short strokes and renders board state', () => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
    const stroke = {
      id: 's1',
      color: '#000',
      width: 2,
      points: [{ x: 0, y: 0 }],
    };
    drawStrokeOnContext(ctx as never, stroke);
    expect(ctx.stroke).not.toHaveBeenCalled();

    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as never);
    renderWhiteboard(canvas, [
      {
        id: 's2',
        color: '#111',
        width: 2,
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      },
    ]);
    expect(ctx.stroke).toHaveBeenCalled();

    renderWhiteboard(canvas, [], {
      id: 'live',
      color: '#222',
      width: 2,
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 4 },
      ],
    });
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it('no-ops when canvas context is missing', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(() => renderWhiteboard(canvas, [])).not.toThrow();
    expect(() => renderWhiteboard(null, [])).not.toThrow();
    expect(() => renderWhiteboard(canvas, [], null)).not.toThrow();
  });
});
