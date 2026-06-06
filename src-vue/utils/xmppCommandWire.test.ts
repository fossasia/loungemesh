import { describe, expect, it } from 'vitest';
import {
  decodeXmppCommandValue,
  encodeXmppCommandValue,
  XMPP_COMMAND_WIRE_PREFIX,
} from './xmppCommandWire';

describe('xmppCommandWire', () => {
  it('round-trips JSON with xml-sensitive characters', () => {
    const json = JSON.stringify({
      action: 'chunk',
      index: 0,
      data: 'data:image/jpeg;base64,abc&<http://x>',
    });
    const wire = encodeXmppCommandValue(json);
    expect(wire.startsWith(XMPP_COMMAND_WIRE_PREFIX)).toBe(true);
    expect(wire).not.toContain(':');
    expect(wire).not.toContain('&');
    expect(wire).not.toContain('<');
    expect(decodeXmppCommandValue(wire)).toBe(json);
  });

  it('passes through legacy plain JSON commands', () => {
    const legacy = JSON.stringify({ text: '# Markdown & <xml>' });
    expect(decodeXmppCommandValue(legacy)).toBe(legacy);
  });
});
