import { describe, expect, it } from 'vitest';
import {
  clearWhiteboardStrokes,
  mergeWhiteboardStroke,
  parseWhiteboardCommand,
} from './whiteboardSync';

describe('whiteboardSync', () => {
  const stroke = {
    id: 's1',
    color: '#000',
    width: 2,
    points: [{ x: 1, y: 2 }],
  };

  it('merges and replaces strokes by id', () => {
    const merged = mergeWhiteboardStroke([stroke], { ...stroke, points: [{ x: 3, y: 4 }] });
    expect(merged).toHaveLength(1);
    expect(merged[0].points[0]).toEqual({ x: 3, y: 4 });
  });

  it('caps stroke history', () => {
    const strokes = Array.from({ length: 301 }, (_, i) => ({
      id: `s${i}`,
      color: '#000',
      width: 2,
      points: [{ x: 0, y: 0 }],
    }));
    const next = mergeWhiteboardStroke(strokes, {
      id: 'new',
      color: '#000',
      width: 2,
      points: [{ x: 1, y: 1 }],
    });
    expect(next.length).toBe(300);
    expect(next[next.length - 1].id).toBe('new');
  });

  it('parses stroke and clear commands', () => {
    expect(parseWhiteboardCommand({ action: 'clear' })).toEqual({ action: 'clear' });
    expect(parseWhiteboardCommand({ action: 'stroke', stroke })).toEqual({
      action: 'stroke',
      stroke,
    });
    expect(parseWhiteboardCommand(null)).toBeNull();
    expect(parseWhiteboardCommand({ action: 'stroke' })).toBeNull();
  });

  it('clears strokes', () => {
    expect(clearWhiteboardStrokes()).toEqual([]);
  });
});
