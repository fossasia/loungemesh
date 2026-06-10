import { describe, expect, it } from 'vitest';
import { emojiCellPx, perLineForWidth } from './emojiPickerLayout';

describe('emojiPickerLayout', () => {
  it('computes emoji cell size from emoji size', () => {
    expect(emojiCellPx(24)).toBe(36);
  });

  it('fits per-line count to container width', () => {
    expect(perLineForWidth(360, 24)).toBe(9);
    expect(perLineForWidth(400, 24)).toBe(10);
    expect(perLineForWidth(352, 24)).toBe(8);
  });

  it('clamps per-line count', () => {
    expect(perLineForWidth(120, 24)).toBe(6);
    expect(perLineForWidth(2000, 24)).toBe(11);
  });

  it('falls back when width is invalid', () => {
    expect(perLineForWidth(0, 24)).toBe(9);
    expect(perLineForWidth(Number.NaN, 24)).toBe(9);
  });
});
