import { whiteboardMaxScale, whiteboardMinScale } from '@/constants/pan';

export type WhiteboardOffset = { x: number; y: number };

export function clampWhiteboardScale(
  scale: number,
  min = whiteboardMinScale,
  max = whiteboardMaxScale,
): number {
  return Math.max(min, Math.min(max, scale));
}

/** Uniform scale delta from a bottom-right resize drag (keeps parent aspect ratio). */
export function scaleFromResizeDelta(
  startScale: number,
  dx: number,
  dy: number,
  parentWidth: number,
  parentHeight: number,
): number {
  if (parentWidth <= 0 || parentHeight <= 0) return startScale;
  const delta = (dx / parentWidth + dy / parentHeight) / 2;
  return clampWhiteboardScale(startScale + delta);
}

export function maxWhiteboardOffset(
  parentWidth: number,
  parentHeight: number,
  scale: number,
): WhiteboardOffset {
  const panelW = parentWidth * scale;
  const panelH = parentHeight * scale;
  return {
    x: Math.max(0, (parentWidth - panelW) / 2),
    y: Math.max(0, (parentHeight - panelH) / 2),
  };
}

export function clampWhiteboardOffset(
  offset: WhiteboardOffset,
  parentWidth: number,
  parentHeight: number,
  scale: number,
): WhiteboardOffset {
  const max = maxWhiteboardOffset(parentWidth, parentHeight, scale);
  return {
    x: Math.max(-max.x, Math.min(max.x, offset.x)),
    y: Math.max(-max.y, Math.min(max.y, offset.y)),
  };
}

export function whiteboardOverlayBox(
  parentWidth: number,
  parentHeight: number,
  scale: number,
  offset: WhiteboardOffset,
): Record<string, string> {
  if (parentWidth <= 0 || parentHeight <= 0) return {};
  const panelW = parentWidth * scale;
  const panelH = parentHeight * scale;
  const clamped = clampWhiteboardOffset(offset, parentWidth, parentHeight, scale);
  const left = (parentWidth - panelW) / 2 + clamped.x;
  const top = (parentHeight - panelH) / 2 + clamped.y;
  return {
    position: 'absolute',
    width: `${panelW}px`,
    height: `${panelH}px`,
    left: `${left}px`,
    top: `${top}px`,
  };
}
