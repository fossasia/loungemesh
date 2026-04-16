import { insertEmojiAtCaret } from './insertEmoji';

/** Insert emoji when the textarea ref is mounted. */
export function addEmojiToInput(
  input: HTMLTextAreaElement | null | undefined,
  emoji: string,
): void {
  if (input) insertEmojiAtCaret(input, emoji);
}

/** Handle chat textarea key events. Returns true when the event was consumed. */
export function handleChatKeydown(
  e: KeyboardEvent,
  textarea: HTMLTextAreaElement,
  send: () => void,
): boolean {
  if (e.key === 'Enter' && e.altKey) {
    e.preventDefault();
    textarea.value += '\n';
    return true;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    send();
    return true;
  }
  return false;
}

/** Send a chat message when input and conference state allow it. */
export function prepareChatSend(
  raw: string,
  hasConference: boolean,
): { ok: true; text: string } | { ok: false } {
  const text = raw.trim();
  if (!text || !hasConference) return { ok: false };
  return { ok: true, text };
}

/** Scroll chat history to the latest message when the container exists. */
export function scrollChatToBottom(el: HTMLElement | null): void {
  if (el) el.scrollTop = el.scrollHeight;
}

/** Send chat text when validation passes. */
export function commitChatSend(
  raw: string,
  hasConference: boolean,
  send: (text: string) => void,
  clear: () => void,
): void {
  const prepared = prepareChatSend(raw, hasConference);
  if (!prepared.ok) return;
  send(prepared.text);
  clear();
}
