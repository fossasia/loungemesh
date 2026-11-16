import { describe, expect, it } from 'vitest';
import { REACTION_DISPLAY_MS } from './sessionEmojis';

describe('sessionEmojis', () => {
  it('exports reaction display duration', () => {
    expect(REACTION_DISPLAY_MS).toBe(2500);
  });
});
