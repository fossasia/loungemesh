import type { WhiteboardPoint, WhiteboardStroke } from './whiteboardSync';

/** Fixed drawing surface; the element is scaled via CSS when the panel is resized. */
export const WHITEBOARD_LOGICAL_SIZE = { width: 1280, height: 720 };

export function ensureWhiteboardCanvasSize(canvas: HTMLCanvasElement): void {
  const { width, height } = WHITEBOARD_LOGICAL_SIZE;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function clientToCanvasPoint(
  canvas: HTMLCanvasElement | null | undefined,
  clientX: number,
  clientY: number,
): WhiteboardPoint | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function drawStrokeOnContext(
  ctx: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
  scaleX = 1,
  scaleY = 1,
): void {
  if (stroke.points.length < 2) return;
  const lineScale = (scaleX + scaleY) / 2;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width * lineScale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
  }
  ctx.stroke();
}

export function renderWhiteboard(
  canvas: HTMLCanvasElement | null | undefined,
  strokes: WhiteboardStroke[],
  current: WhiteboardStroke | null = null,
  size: { width: number; height: number } = WHITEBOARD_LOGICAL_SIZE,
): void {
  if (!canvas) return;
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scaleX = size.width / WHITEBOARD_LOGICAL_SIZE.width;
  const scaleY = size.height / WHITEBOARD_LOGICAL_SIZE.height;
  for (const stroke of strokes) {
    drawStrokeOnContext(ctx, stroke, scaleX, scaleY);
  }
  if (current) drawStrokeOnContext(ctx, current, scaleX, scaleY);
}
