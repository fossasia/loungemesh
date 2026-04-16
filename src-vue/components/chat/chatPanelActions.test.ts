import { describe, expect, it, vi } from 'vitest';
import {
  addEmojiToInput,
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
    expect(prepareChatSend('   ', true)).toEqual({ ok: false });
    expect(prepareChatSend('hello', false)).toEqual({ ok: false });
  });

  it('commits a valid chat message', () => {
    const send = vi.fn();
    const clear = vi.fn();
    commitChatSend('  hello  ', true, send, clear);
    expect(send).toHaveBeenCalledWith('hello');
    expect(clear).toHaveBeenCalled();
    commitChatSend('   ', true, send, clear);
    expect(send).toHaveBeenCalledTimes(1);
    commitChatSend('hello', false, send, clear);
    expect(send).toHaveBeenCalledTimes(1);
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

  it('scrolls only when the chat root exists', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { value: 120, configurable: true });
    scrollChatToBottom(el);
    expect(el.scrollTop).toBe(120);
    scrollChatToBottom(null);
  });
});
