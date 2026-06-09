import { describe, expect, it, vi } from 'vitest';
import {
  applyChatEdit,
  canApplyChatEdit,
  canEditChatMessage,
  chatAuthorHue,
  createChatMessage,
  formatEditedAt,
} from './chatMessage';

describe('chatMessage', () => {
  it('creates and edits messages with history', () => {
    const msg = createChatMessage('u1', 'hello', 1, 'm1');
    expect(msg.messageId).toBe('m1');
    expect(applyChatEdit([msg], { messageId: 'missing' }, 'x', 1)).toEqual([msg]);
    const bare = { id: 'u1', text: 'hi', nr: 2, messageId: 'm2' };
    const editedBare = applyChatEdit([bare], { messageId: 'm2' }, 'hi2', 2000);
    expect(editedBare[0].history).toEqual(['hi']);
    const edited = applyChatEdit([msg], { messageId: 'm1' }, 'hello again', 1000);
    expect(edited[0].text).toBe('hello again');
    expect(edited[0].history).toEqual(['hello']);
    expect(applyChatEdit(edited, { messageId: 'm1' }, 'hello again', 1000)).toBe(edited);
  });

  it('formats edited time and author styling', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function MockDateTimeFormat() {
      return { format: () => 'Jan 1, 2025, 3:00 PM' } as Intl.DateTimeFormat;
    });
    expect(formatEditedAt(0)).toBe('Jan 1, 2025, 3:00 PM');
    expect(chatAuthorHue('abc')).toBeGreaterThanOrEqual(0);
    expect(canEditChatMessage(createChatMessage('u1', 'x', 1), 'u1')).toBe(true);
    expect(canEditChatMessage(createChatMessage('u1', 'x', 1), 'u2')).toBe(false);
    expect(canEditChatMessage(createChatMessage('u1', 'x', 1), '')).toBe(false);

    const messages = [createChatMessage('u1', 'x', 1)];
    expect(canApplyChatEdit(messages, messages[0].messageId, 'u1')).toBe(true);
    expect(canApplyChatEdit(messages, messages[0].messageId, 'u2')).toBe(false);
    expect(canApplyChatEdit(messages, 'missing', 'u1')).toBe(false);
    expect(canApplyChatEdit(messages, 'sender-uuid', 'u1', 1)).toBe(true);
    expect(canApplyChatEdit(messages, 'sender-uuid', 'u2', 1)).toBe(false);
  });
});
