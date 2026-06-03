import { describe, expect, it } from 'vitest';
import { formatSphereName } from './formatSphereName';

describe('formatSphereName', () => {
  it('formats possessive sphere names', () => {
    expect(formatSphereName('Alex')).toBe("Alex's Sphere");
    expect(formatSphereName('James')).toBe("James' Sphere");
  });

  it('returns default for empty input', () => {
    expect(formatSphereName('')).toBe('Friendly Sphere');
    expect(formatSphereName('   ')).toBe('Friendly Sphere');
  });
});
