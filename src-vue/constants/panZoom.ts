import type { PanVec } from '@/constants/pan';
import { clampPan, clampScale } from '@/constants/pan';

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

export function applyZoomStep(
  pan: PanVec,
  scale: number,
  step: number,
  anchorX: number,
  anchorY: number,
): { pan: PanVec; scale: number } {
  return panForZoomAtPoint(pan, scale, scale + step, anchorX, anchorY);
}

export function clampedPanZoom(pan: PanVec, scale: number): { pan: PanVec; scale: number } {
  const s = clampScale(scale);
  return { pan: clampPan(pan, s), scale: s };
}
