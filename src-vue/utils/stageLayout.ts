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
  return map[`${horizontal[0]}${vertical[0]}`] ?? 'br';
}

export function pipStyleForLayout(
  layout: StageLayout,
  containerWidth: number,
  _containerHeight: number,
  animate: boolean,
): Record<string, string> {
  const size = pipSizeForContainer(containerWidth);
  const padding = 8;
  const corner = layout.pipCorner;
  const offset = layout.pipOffset;
  const style: Record<string, string> = {
    width: `${size}px`,
    height: `${size}px`,
    position: 'absolute',
  };
  if (animate) {
    style.transition = 'left 0.2s ease, right 0.2s ease, top 0.2s ease, bottom 0.2s ease, transform 0.2s ease';
  }
  if (corner === 'tl') {
    style.left = `${padding + offset.x}px`;
    style.top = `${padding + offset.y}px`;
  } else if (corner === 'tr') {
    style.right = `${padding - offset.x}px`;
    style.top = `${padding + offset.y}px`;
  } else if (corner === 'bl') {
    style.left = `${padding + offset.x}px`;
    style.bottom = `${padding - offset.y}px`;
  } else {
    style.right = `${padding - offset.x}px`;
    style.bottom = `${padding - offset.y}px`;
  }
  return style;
}

export function scaleFromResizeDelta(startScale: number, dx: number, containerWidth: number): number {
  if (containerWidth <= 0) return startScale;
  return clampStageScale(startScale + dx / containerWidth);
}
