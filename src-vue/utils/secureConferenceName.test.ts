import { describe, expect, it } from 'vitest';
import { secureConferenceName } from './secureConferenceName';

describe('secureConferenceName', () => {
  it('normalizes and prefixes room names', () => {
    expect(secureConferenceName('My-Room!', 'cms')).toBe('cmsmy-room');
  });

  it('uses default prefix when none provided', () => {
    expect(secureConferenceName('Hallway')).toBe('flshallway');
  });

  it('throws when name is missing', () => {
    expect(() => secureConferenceName(undefined)).toThrow('no Conference Name');
  });
});
