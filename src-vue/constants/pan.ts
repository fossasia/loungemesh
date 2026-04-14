/** Pan/zoom position in screen pixels. */
export type PanVec = { x: number; y: number };

export const roomSize = { x: 6000, y: 6000 };
export const userSize = { x: 200, y: 200 };

/** Fixed chrome: header (top-right), footer bar — used to center the local avatar in the visible area. */
export const viewportChrome = { top: 16, bottom: 88, left: 16, right: 16 };

export function randomInitialUserPosition(): PanVec {
  return {
    x: roomSize.x / 2 - userSize.x / 2,
    y: roomSize.y / 2 - userSize.y / 2,
  };
}

export const minScale = 0.3;
export const maxScale = 3;
export const defaultScale = 0.65;

/** Visible area inside the session UI (below header, above footer). */
export function visibleViewport(): { width: number; height: number } {
  return {
    width: Math.max(320, window.innerWidth - viewportChrome.left - viewportChrome.right),
    height: Math.max(320, window.innerHeight - viewportChrome.top - viewportChrome.bottom),
  };
}

export function clampScale(scale: number): number {
  return Math.max(minScale, Math.min(maxScale, scale));
}

/** Legacy `transformWrapperOptions.defaultPositionX/Y` + `onPanChange` clamp. */
export function clampPan(pan: PanVec, scale: number): PanVec {
  const roomW = roomSize.x * scale;
  const roomH = roomSize.y * scale;
  const { width, height } = visibleViewport();
  const dx = width - roomW;
  const dy = height - roomH;
  const minX = Math.min(0, dx);
  const maxX = Math.max(0, dx);
  const minY = Math.min(0, dy);
  const maxY = Math.max(0, dy);
  return {
    x: Math.max(minX, Math.min(maxX, pan.x)),
    y: Math.max(minY, Math.min(maxY, pan.y)),
  };
}

/** Pan so the local avatar is centered in the visible viewport (not the raw window). */
export function initialPanCenterOnUser(userPos: PanVec, scale = defaultScale): PanVec {
  const { width, height } = visibleViewport();
  const centerX = viewportChrome.left + width / 2;
  const centerY = viewportChrome.top + height / 2;
  return {
    x: centerX - (userPos.x + userSize.x / 2) * scale,
    y: centerY - (userPos.y + userSize.y / 2) * scale,
  };
}
