import { describe, expect, it } from 'vitest';
import { splitMessage } from './splitMessage';

describe('splitMessage', () => {
  it('returns plain text when there are no links', () => {
    expect(splitMessage('hello world')).toEqual([{ text: 'hello world' }]);
  });

  it('returns a fallback segment for empty input', () => {
    expect(splitMessage('')).toEqual([{ text: '' }]);
  });

  it('parses a link-only message', () => {
    expect(splitMessage('https://only.example')).toEqual([
      { text: 'https://only.example', href: 'https://only.example' },
    ]);
  });

  it('parses leading text, a link, and trailing text', () => {
    expect(splitMessage('before https://link.test/path after')).toEqual([
      { text: 'before ' },
      { text: 'https://link.test/path', href: 'https://link.test/path' },
      { text: ' after' },
    ]);
  });
});
