import type { WhiteboardPoint, WhiteboardStroke } from './whiteboardSync';

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
): void {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

export function renderWhiteboard(
  canvas: HTMLCanvasElement | null | undefined,
  strokes: WhiteboardStroke[],
  current: WhiteboardStroke | null = null,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    drawStrokeOnContext(ctx, stroke);
  }
  if (current) drawStrokeOnContext(ctx, current);
}
