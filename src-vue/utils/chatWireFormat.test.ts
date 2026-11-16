import { describe, expect, it } from 'vitest';
import { decodeChatWireText, encodeChatWireText } from './chatWireFormat';

describe('chatWireFormat', () => {
  it('round-trips message ids without changing display text', () => {
    const wire = encodeChatWireText('uuid-1', 'hello world');
    expect(decodeChatWireText(wire)).toEqual({ messageId: 'uuid-1', text: 'hello world' });
  });

  it('passes through plain text without metadata', () => {
    expect(decodeChatWireText('legacy message')).toEqual({ text: 'legacy message' });
  });
});
