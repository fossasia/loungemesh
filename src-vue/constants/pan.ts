/** Pan/zoom position in screen pixels. */
export type PanVec = { x: number; y: number };

/** Minimum canvas size (starting area before anyone moves). */
export const minRoomSize = { x: 6000, y: 6000 };

/** @deprecated Use minRoomSize — kept for existing imports/tests. */
export const roomSize = minRoomSize;

export const userSize = { x: 200, y: 200 };

/** Padding around all spheres when computing the live canvas bounds. */
export const roomPadding = 1200;

/** Extra pan bleed past content edges so the viewport never feels locked. */
export const panBleed = 240;

/** Fixed chrome: header (top-right), footer bar — used to center the local avatar in the visible area. */
export const viewportChrome = { top: 56, bottom: 88, left: 32, right: 32 };

/** Extra horizontal inset for the full-screen whiteboard overlay. */
export const whiteboardChrome = {
  top: viewportChrome.top,
  bottom: viewportChrome.bottom,
  left: 56,
  right: 56,
};

export type RoomBounds = {
  origin: PanVec;
  size: PanVec;
};

export const defaultRoomBounds = (): RoomBounds => ({
  origin: { x: 0, y: 0 },
  size: { ...minRoomSize },
});

/** Convert world position to coordinates inside the room element. */
export function worldToRoom(pos: PanVec, bounds: RoomBounds): PanVec {
  return {
    x: pos.x - bounds.origin.x,
    y: pos.y - bounds.origin.y,
  };
}

/**
 * Compute canvas bounds that contain every sphere, with padding.
 * When `previous` is passed, the result only grows (never shrinks mid-session).
 */
export function computeRoomBounds(positions: PanVec[], previous?: RoomBounds): RoomBounds {
  const pad = roomPadding;
  let next = defaultRoomBounds();

  const finite = positions.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );

  if (finite.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of finite) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + userSize.x);
      maxY = Math.max(maxY, p.y + userSize.y);
    }
    const width = Math.max(maxX - minX + pad * 2, minRoomSize.x);
    const height = Math.max(maxY - minY + pad * 2, minRoomSize.y);
    const originX = minX - (width - (maxX - minX)) / 2;
    const originY = minY - (height - (maxY - minY)) / 2;
    next = {
      origin: { x: originX, y: originY },
      size: { x: width, y: height },
    };
  }

  if (!previous) return next;

  const prevMaxX = previous.origin.x + previous.size.x;
  const prevMaxY = previous.origin.y + previous.size.y;
  const nextMaxX = next.origin.x + next.size.x;
  const nextMaxY = next.origin.y + next.size.y;
  const originX = Math.min(previous.origin.x, next.origin.x);
  const originY = Math.min(previous.origin.y, next.origin.y);
  const maxX = Math.max(prevMaxX, nextMaxX);
  const maxY = Math.max(prevMaxY, nextMaxY);
  return {
    origin: { x: originX, y: originY },
    size: { x: maxX - originX, y: maxY - originY },
  };
}

/** Center of the default room in world coordinates. */
export function roomCenter(): PanVec {
  return {
    x: minRoomSize.x / 2 - userSize.x / 2,
    y: minRoomSize.y / 2 - userSize.y / 2,
  };
}

export function randomInitialUserPosition(): PanVec {
  return roomCenter();
}

/** Center of a 200×200 sphere (world coordinates). */
export function sphereCenter(pos: PanVec): PanVec {
  return { x: pos.x + userSize.x / 2, y: pos.y + userSize.y / 2 };
}

/** True when two sphere bounding boxes overlap (same size as local/remote video circles). */
export function spheresOverlap(a: PanVec, b: PanVec, size = userSize): boolean {
  return !(
    a.x + size.x <= b.x ||
    b.x + size.x <= a.x ||
    a.y + size.y <= b.y ||
    b.y + size.y <= a.y
  );
}

function finitePositions(positions: PanVec[]): PanVec[] {
  return positions.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/** Place a new sphere so its video circle does not overlap any existing sphere. */
export function spreadInitialUserPosition(existing: PanVec[]): PanVec {
  const others = finitePositions(existing);
  if (others.length === 0) return roomCenter();

  const base = roomCenter();
  const step = userSize.x;
  for (let attempt = 0; attempt < 96; attempt++) {
    const angle = attempt * 2.399963;
    const radius = step * (1.05 + attempt * 0.5);
    const candidate = {
      x: base.x + Math.cos(angle) * radius,
      y: base.y + Math.sin(angle) * radius,
    };
    if (!others.some((p) => spheresOverlap(candidate, p))) return candidate;
  }

  const n = others.length;
  const angle = n * 2.399963;
  const radius = step * (2 + Math.sqrt(n));
  return {
    x: base.x + Math.cos(angle) * radius,
    y: base.y + Math.sin(angle) * radius,
  };
}

/** Keep zoom within a range where the room stays navigable (not tiny or selfie-only). */
export const minScale = 0.35;
export const maxScale = 2.5;
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

/** Clamp viewport pan so the scaled room stays reachable (supports dynamic bounds). */
export function clampPan(pan: PanVec, scale: number, bounds: RoomBounds = defaultRoomBounds()): PanVec {
  const { width, height } = visibleViewport();
  const contentX = bounds.origin.x * scale;
  const contentY = bounds.origin.y * scale;
  const contentW = bounds.size.x * scale;
  const contentH = bounds.size.y * scale;
  const bleed = panBleed;

  const minX = width - contentX - contentW - bleed;
  const maxX = -contentX + bleed;
  const minY = height - contentY - contentH - bleed;
  const maxY = -contentY + bleed;

  const xLo = Math.min(minX, maxX);
  const xHi = Math.max(minX, maxX);
  const yLo = Math.min(minY, maxY);
  const yHi = Math.max(minY, maxY);

  return {
    x: Math.max(xLo, Math.min(xHi, pan.x)),
    y: Math.max(yLo, Math.min(yHi, pan.y)),
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
