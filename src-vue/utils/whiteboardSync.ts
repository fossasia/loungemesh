/** Coordinates in whiteboard logical pixel space (1280×720). */
export type WhiteboardPoint = { x: number; y: number };
export type WhiteboardStroke = {
  id: string;
  color: string;
  width: number;
  points: WhiteboardPoint[];
};

export type WhiteboardCommand =
  | { action: 'stroke'; stroke: WhiteboardStroke }
  | { action: 'clear' };

const MAX_STROKES = 300;

export function mergeWhiteboardStroke(
  strokes: WhiteboardStroke[],
  stroke: WhiteboardStroke,
): WhiteboardStroke[] {
  const without = strokes.filter((s) => s.id !== stroke.id);
  const next = [...without, stroke];
  if (next.length <= MAX_STROKES) return next;
  return next.slice(next.length - MAX_STROKES);
}

export function clearWhiteboardStrokes(): WhiteboardStroke[] {
  return [];
}

export function parseWhiteboardCommand(raw: unknown): WhiteboardCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as { action?: string; stroke?: WhiteboardStroke };
  if (data.action === 'clear') return { action: 'clear' };
  if (data.action === 'stroke' && data.stroke?.id && Array.isArray(data.stroke.points)) {
    return { action: 'stroke', stroke: data.stroke };
  }
  return null;
}
