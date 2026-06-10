export type Hsv = { h: number; s: number; v: number };

export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${[...raw].map((c) => c + c).join('').toLowerCase()}`;
  }
  return null;
}

export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function hexToHsv(hex: string): Hsv | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sat = s / 100;
  const val = v / 100;
  const c = val * sat;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh >= 0 && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = val - c;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

export const WHITEBOARD_HUE_RING = { inner: 0.66, outer: 1 };

export function hueFromWheelEvent(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  ring = WHITEBOARD_HUE_RING,
): number | null {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const maxR = Math.min(rect.width, rect.height) / 2;
  const dist = Math.hypot(dx, dy);
  if (dist < maxR * ring.inner || dist > maxR * ring.outer) return null;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;
  return angle;
}

export function svFromBoxEvent(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): { s: number; v: number } {
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  return { s: x * 100, v: (1 - y) * 100 };
}

export function hueMarkerPosition(
  h: number,
  ring = WHITEBOARD_HUE_RING,
): { left: string; top: string } {
  const radiusPercent = ((ring.inner + ring.outer) / 2) * 50;
  const rad = ((h - 90) * Math.PI) / 180;
  const left = 50 + Math.cos(rad) * radiusPercent;
  const top = 50 + Math.sin(rad) * radiusPercent;
  return { left: `${left}%`, top: `${top}%` };
}
