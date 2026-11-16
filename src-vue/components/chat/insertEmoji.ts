/** Resolve textarea caret indices (handles missing/invalid selection). */
export function readCaret(textarea: HTMLTextAreaElement): { start: number; end: number } {
  const len = textarea.value.length;
  const rawStart = textarea.selectionStart;
  const rawEnd = textarea.selectionEnd;
  const start =
    typeof rawStart === 'number' && !Number.isNaN(rawStart) ? rawStart : len;
  const end = typeof rawEnd === 'number' && !Number.isNaN(rawEnd) ? rawEnd : start;
  return { start, end };
}

/** Insert emoji at the textarea caret. */
export function insertEmojiAtCaret(textarea: HTMLTextAreaElement, emoji: string): void {
  const { start, end } = readCaret(textarea);
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = `${before}${emoji}${after}`;
  const pos = start + emoji.length;
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
  textarea.focus();
}
