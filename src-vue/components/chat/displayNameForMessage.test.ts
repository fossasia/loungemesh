import { describe, expect, it } from 'vitest';
import { displayNameForMessage } from './displayNameForMessage';

describe('displayNameForMessage', () => {
  const users = {
    bob: { user: { _displayName: 'Bob' } },
    blank: { user: { _displayName: '   ' } },
  };

  it('labels the local participant as You', () => {
    expect(displayNameForMessage('me', 'me', users)).toBe('You');
  });

  it('uses remote display names when available', () => {
    expect(displayNameForMessage('bob', 'me', users)).toBe('Bob');
  });

  it('falls back to You for unknown or blank names', () => {
    expect(displayNameForMessage('ghost', 'me', users)).toBe('You');
    expect(displayNameForMessage('blank', 'me', users)).toBe('You');
    expect(displayNameForMessage('', 'me', users)).toBe('You');
    expect(displayNameForMessage('bob', '', users)).toBe('Bob');
  });
});
