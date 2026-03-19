type PanVec = { x: number; y: number };

export const roomSize = { x: 6000, y: 6000 };
export const userSize = { x: 200, y: 200 };

export function randomInitialUserPosition(): PanVec {
  return {
    // Start dead-center so the first render is centered like production.
    x: roomSize.x / 2 - userSize.x / 2,
    y: roomSize.y / 2 - userSize.y / 2,
  };
}

export const minScale = 0.3;
export const maxScale = 3;
// Production feels more zoomed out than 1.0; user requested ~25% further out.
export const defaultScale = 0.65;
// Pan is stored in SCREEN PIXELS (not world units).

export function clampScale(scale: number): number {
  return Math.max(minScale, Math.min(maxScale, scale));
}

/** Legacy `transformWrapperOptions.defaultPositionX/Y` + `onPanChange` clamp. */
export function clampPan(pan: PanVec, scale: number): PanVec {
  const roomW = roomSize.x * scale;
  const roomH = roomSize.y * scale;
  const dx = window.innerWidth - roomW;
  const dy = window.innerHeight - roomH;
  // If room bigger than viewport => dx negative => range [dx, 0]
  // If room smaller than viewport => dx positive => range [0, dx] (centerable)
  const minX = Math.min(0, dx);
  const maxX = Math.max(0, dx);
  const minY = Math.min(0, dy);
  const maxY = Math.max(0, dy);
  return {
    x: Math.max(minX, Math.min(maxX, pan.x)),
    y: Math.max(minY, Math.min(maxY, pan.y)),
  };
}

export function initialPanCenterOnUser(userPos: PanVec, scale = 1): PanVec {
  return {
    x: -userPos.x * scale + (window.innerWidth - userSize.x * scale) / 2,
    y: -userPos.y * scale + (window.innerHeight - userSize.y * scale) / 2,
  };
}

