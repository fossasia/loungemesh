import { describe, expect, it, vi } from 'vitest';
import {
  addEmojiToInput,
  commitChatEdit,
  commitChatSend,
  handleChatKeydown,
  prepareChatSend,
  scrollChatToBottom,
} from './chatPanelActions';

describe('chatPanelActions', () => {
  it('inserts a newline on alt+enter', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'line';
    const send = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'Enter', altKey: true, cancelable: true });
    const consumed = handleChatKeydown(event, textarea, send);
    expect(consumed).toBe(true);
    expect(textarea.value).toBe('line\n');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends on enter', () => {
    const textarea = document.createElement('textarea');
    const send = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    handleChatKeydown(event, textarea, send);
    expect(send).toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const textarea = document.createElement('textarea');
    const send = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    expect(handleChatKeydown(event, textarea, send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('validates outgoing messages', () => {
    expect(prepareChatSend('  hello  ', true)).toEqual({ ok: true, text: 'hello' });
    expect(prepareChatSend('   ', true)).toEqual({ ok: false, reason: 'empty' });
    expect(prepareChatSend('hello', false)).toEqual({ ok: false, reason: 'not_ready' });
  });

  it('commits a valid chat message', () => {
    const send = vi.fn(() => true);
    const onSent = vi.fn();
    const result = commitChatSend('  hello  ', true, send, onSent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messageId).toBeTruthy();
    expect(send).toHaveBeenCalledWith('hello');
    expect(onSent).toHaveBeenCalledWith('hello', expect.any(String));
    expect(commitChatSend('   ', true, send, onSent)).toEqual({ ok: false, reason: 'empty' });
    expect(commitChatSend('hello', false, send, onSent)).toEqual({
      ok: false,
      reason: 'not_ready',
    });
    send.mockReturnValue(false);
    expect(commitChatSend('fail', true, send, onSent)).toEqual({ ok: false, reason: 'send_failed' });
  });

  it('adds emoji when input exists', () => {
    const el = document.createElement('textarea');
    el.value = 'hi';
    addEmojiToInput(el, '👍');
    expect(el.value).toBe('hi👍');
  });

  it('skips emoji when input is missing', () => {
    expect(() => addEmojiToInput(null, '👍')).not.toThrow();
  });

  it('uses a fallback id when crypto.randomUUID is unavailable', () => {
    const uuid = globalThis.crypto?.randomUUID;
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
    });
    const send = vi.fn(() => true);
    const onSent = vi.fn();
    const result = commitChatSend('hi', true, send, onSent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messageId).toMatch(/^m-/);
    if (uuid) Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: uuid }, configurable: true });
  });

  it('commits chat edits', () => {
    const publish = vi.fn();
    expect(commitChatEdit('  hi  ', true, publish, 'm1')).toEqual({ ok: true });
    expect(publish).toHaveBeenCalledWith('m1', 'hi', expect.any(Number));
    expect(commitChatEdit('   ', true, publish, 'm1')).toEqual({ ok: false, reason: 'empty' });
  });

  it('scrolls only when the chat root exists', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { value: 120, configurable: true });
    scrollChatToBottom(el);
    expect(el.scrollTop).toBe(120);
    scrollChatToBottom(null);
  });
});
