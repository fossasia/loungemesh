import { encodeChatWireText } from '@/utils/chatWireFormat';
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

/** Whether the client can send chat (conference handle is ready). */
export function canSendChat(hasConference: boolean): boolean {
  return hasConference;
}

/** Send a chat message when input and conference state allow it. */
export function prepareChatSend(
  raw: string,
  hasConference: boolean,
): { ok: true; text: string } | { ok: false; reason: 'empty' | 'not_ready' } {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (!canSendChat(hasConference)) return { ok: false, reason: 'not_ready' };
  return { ok: true, text };
}

/** Scroll chat history to the latest message when the container exists. */
export function scrollChatToBottom(el: HTMLElement | null): void {
  if (el) el.scrollTop = el.scrollHeight;
}

export type ChatSendResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: 'empty' | 'not_ready' | 'send_failed' };

export type ChatEditResult = { ok: true } | { ok: false; reason: 'empty' | 'not_ready' };

/** Send chat text when validation passes. */
export function commitChatSend(
  raw: string,
  hasConference: boolean,
  send: (text: string) => boolean,
  onSent: (text: string, messageId: string) => void,
): ChatSendResult {
  const prepared = prepareChatSend(raw, hasConference);
  if (!prepared.ok) return prepared;
  const messageId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now()}`;
  const delivered = send(encodeChatWireText(messageId, prepared.text));
  if (!delivered) return { ok: false, reason: 'send_failed' };
  onSent(prepared.text, messageId);
  return { ok: true, messageId };
}

/** Publish a chat edit to the room via conference command. */
export function commitChatEdit(
  raw: string,
  hasConference: boolean,
  publish: (messageId: string, text: string, editedAt: number) => void,
  messageId: string,
): ChatEditResult {
  const prepared = prepareChatSend(raw, hasConference);
  if (!prepared.ok) return prepared;
  publish(messageId, prepared.text, Date.now());
  return { ok: true };
}
