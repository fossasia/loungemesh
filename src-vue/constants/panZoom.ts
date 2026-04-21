import type { PanVec, RoomBounds } from '@/constants/pan';
import { clampPan, clampScale, defaultRoomBounds } from '@/constants/pan';

/** Zoom toward a screen point (cursor); keeps that point fixed on screen. */
export function panForZoomAtPoint(
  pan: PanVec,
  scale: number,
  nextScale: number,
  clientX: number,
  clientY: number,
): { pan: PanVec; scale: number } {
  const clamped = clampScale(nextScale);
  if (clamped === scale) return { pan, scale };
  const ratio = clamped / scale;
  return {
    scale: clamped,
    pan: {
      x: clientX - (clientX - pan.x) * ratio,
      y: clientY - (clientY - pan.y) * ratio,
    },
  };
}

/** Scale delta from a wheel / trackpad gesture (clamped per event). */
export function wheelScaleDelta(e: WheelEvent): number {
  let dy = -e.deltaY;
  if (e.deltaMode === 1) dy *= 0.2;
  else if (e.deltaMode === 2) dy *= 1.5;
  const sens = e.ctrlKey ? 0.0025 : 0.0006;
  const step = dy * sens;
  return Math.max(-0.05, Math.min(0.05, step));
}

export function applyZoomStep(
  pan: PanVec,
  scale: number,
  step: number,
  anchorX: number,
  anchorY: number,
): { pan: PanVec; scale: number } {
  return panForZoomAtPoint(pan, scale, scale + step, anchorX, anchorY);
}

export function clampedPanZoom(
  pan: PanVec,
  scale: number,
  bounds: RoomBounds = defaultRoomBounds(),
): { pan: PanVec; scale: number } {
  const s = clampScale(scale);
  return { pan: clampPan(pan, s, bounds), scale: s };
}
