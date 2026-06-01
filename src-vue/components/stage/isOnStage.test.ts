import { describe, expect, it } from 'vitest';
import { isOnStage } from './isOnStage';

describe('isOnStage', () => {
  it('accepts boolean and string stage flags', () => {
    expect(isOnStage(true)).toBe(true);
    expect(isOnStage('true')).toBe(true);
    expect(isOnStage(false)).toBe(false);
    expect(isOnStage('false')).toBe(false);
    expect(isOnStage(undefined)).toBe(false);
  });
});
