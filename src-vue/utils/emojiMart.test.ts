import { describe, expect, it } from 'vitest';
import { getEmojiIndex, nativeFromEmojiMart } from './emojiMart';

describe('emojiMart', () => {
  it('returns a shared emoji index', () => {
    expect(getEmojiIndex()).toBe(getEmojiIndex());
  });

  it('extracts native emoji from picker selection', () => {
    expect(nativeFromEmojiMart({ native: '👍' })).toBe('👍');
  });
});
