import { describe, expect, it } from 'vitest';
import { insertEmojiAtCaret, readCaret } from './insertEmoji';

describe('insertEmojiAtCaret', () => {
  it('appends emoji when selection is unset', () => {
    const el = document.createElement('textarea');
    el.value = 'yo';
    insertEmojiAtCaret(el, '🎉');
    expect(el.value).toBe('yo🎉');
  });

  it('readCaret falls back for invalid selection', () => {
    const el = document.createElement('textarea');
    el.value = 'abc';
    Object.defineProperty(el, 'selectionStart', { get: () => Number.NaN, configurable: true });
    Object.defineProperty(el, 'selectionEnd', { get: () => Number.NaN, configurable: true });
    expect(readCaret(el)).toEqual({ start: 3, end: 3 });
  });

  it('readCaret falls back when only selectionEnd is invalid', () => {
    const el = document.createElement('textarea');
    el.value = 'abc';
    el.selectionStart = 1;
    Object.defineProperty(el, 'selectionEnd', { get: () => Number.NaN, configurable: true });
    expect(readCaret(el)).toEqual({ start: 1, end: 1 });
  });

  it('inserts emoji at selection', () => {
    const el = document.createElement('textarea');
    el.value = 'hi ';
    el.selectionStart = 3;
    el.selectionEnd = 3;
    insertEmojiAtCaret(el, '👍');
    expect(el.value).toBe('hi 👍');
    expect(el.selectionStart).toBe(5);
  });
});
