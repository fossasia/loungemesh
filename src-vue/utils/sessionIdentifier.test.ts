import { describe, expect, it } from 'vitest';
import { sessionIdentifier } from './sessionIdentifier';

describe('sessionIdentifier', () => {
  it('stringifies route params', () => {
    expect(sessionIdentifier('room')).toBe('room');
    expect(sessionIdentifier(undefined)).toBe('');
  });
});
