/** Padding, border, scrollbar, and rounding safety for emoji-mart's width formula. */
export const EMOJI_PICKER_CHROME_PX = 36;

export function emojiCellPx(emojiSize: number): number {
  return emojiSize + 12;
}

/** How many emojis fit on one row for a given container width. */
export function perLineForWidth(
  containerWidthPx: number,
  emojiSize: number,
  min = 6,
  max = 11,
): number {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) return 9;
  const fit = Math.floor((containerWidthPx - EMOJI_PICKER_CHROME_PX) / emojiCellPx(emojiSize));
  return Math.max(min, Math.min(max, fit));
}
