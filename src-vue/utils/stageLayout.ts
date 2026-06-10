import type { StageLayout, StagePipCorner } from '@/stores/sessionFeaturesStore';

export const STAGE_MIN_SCALE = 0.75;
export const STAGE_MAX_SCALE = 1.35;

export function clampStageScale(scale: number): number {
  return Math.max(STAGE_MIN_SCALE, Math.min(STAGE_MAX_SCALE, scale));
}

/** Camera pip overlay on a screenshare — keep compact even on large presentations. */
export function pipSizeForContainer(containerWidth: number): number {
  const proportional = Math.round(containerWidth * 0.12);
  return Math.max(36, Math.min(64, proportional));
}

export function cornerAnchor(corner: StagePipCorner): { x: string; y: string } {
  switch (corner) {
    case 'tl':
      return { x: 'left', y: 'top' };
    case 'tr':
      return { x: 'right', y: 'top' };
    case 'bl':
      return { x: 'left', y: 'bottom' };
    case 'br':
    default:
      return { x: 'right', y: 'bottom' };
  }
}

export function nearestPipCorner(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
): StagePipCorner {
  const midX = containerWidth / 2;
  const midY = containerHeight / 2;
  const horizontal = x < midX ? 'l' : 'r';
  const vertical = y < midY ? 't' : 'b';
  const map: Record<string, StagePipCorner> = {
    lt: 'tl',
    rt: 'tr',
    lb: 'bl',
    rb: 'br',
  };
  return map[`${horizontal[0]}${vertical[0]}`];
}

export function getPipRatio(
  layout: StageLayout,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  const corner = layout.pipCorner;
  const offset = layout.pipOffset;

  if (offset.x === 0 && offset.y === 0) {
    if (corner === 'tl') return { x: 0, y: 0 };
    if (corner === 'tr') return { x: 1, y: 0 };
    if (corner === 'bl') return { x: 0, y: 1 };
    return { x: 1, y: 1 }; // 'br'
  }

  let rx = offset.x;
  let ry = offset.y;

  // Convert legacy pixel values to ratios if they are absolute pixels
  if (Math.abs(rx) > 1 || Math.abs(ry) > 1) {
    const size = pipSizeForContainer(containerWidth);
    const padding = 8;
    const usableWidth = containerWidth - size - padding * 2;
    const usableHeight = containerHeight - size - padding * 2;

    let baseX = padding;
    let baseY = padding;
    if (corner === 'tr' || corner === 'br') {
      baseX = containerWidth - size - padding;
    }
    if (corner === 'bl' || corner === 'br') {
      baseY = containerHeight - size - padding;
    }

    const px = baseX + rx;
    const py = baseY + ry;

    rx = usableWidth > 0 ? (px - padding) / usableWidth : 0;
    ry = usableHeight > 0 ? (py - padding) / usableHeight : 0;
  }

  return { x: rx, y: ry };
}

export function pipStyleForLayout(
  layout: StageLayout,
  containerWidth: number,
  containerHeight: number,
  animate: boolean,
): Record<string, string> {
  const size = pipSizeForContainer(containerWidth);
  const padding = 8;
  const ratio = getPipRatio(layout, containerWidth, containerHeight);

  const usableWidth = containerWidth - size - padding * 2;
  const usableHeight = containerHeight - size - padding * 2;
  const leftPx = padding + ratio.x * usableWidth;
  const topPx = padding + ratio.y * usableHeight;

  const style: Record<string, string> = {
    width: `${size}px`,
    height: `${size}px`,
    position: 'absolute',
    left: `${leftPx}px`,
    top: `${topPx}px`,
  };

  if (animate) {
    style.transition = 'left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease';
  }

  return style;
}

export function scaleFromResizeDelta(startScale: number, dx: number, containerWidth: number): number {
  if (containerWidth <= 0) return startScale;
  return clampStageScale(startScale + dx / containerWidth);
}
