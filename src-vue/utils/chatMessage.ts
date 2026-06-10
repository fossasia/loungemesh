import type { ChatMessage } from '@/stores/conferenceStore';

/** Stable hue for a participant id (chat author color). */
export function chatAuthorHue(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function chatAuthorStyle(userId: string): { color: string } {
  return { color: `hsl(${chatAuthorHue(userId)}, 55%, 38%)` };
}

/** Format edited timestamp in the viewer's local timezone. */
export function formatEditedAt(editedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(editedAt));
}

export function canEditChatMessage(message: ChatMessage, localUserId: string): boolean {
  return !!localUserId && message.id === localUserId;
}

export type ChatMessageRef = {
  messageId: string;
  nr?: number;
  authorId?: string;
};

export function findChatMessage(
  messages: ChatMessage[],
  ref: ChatMessageRef,
): ChatMessage | undefined {
  const byId = messages.find((m) => m.messageId === ref.messageId);
  if (byId) return byId;
  if (ref.nr == null || !ref.authorId) return undefined;
  return messages.find((m) => m.nr === ref.nr && m.id === ref.authorId);
}

export function canApplyChatEdit(
  messages: ChatMessage[],
  messageId: string,
  editorId: string,
  nr?: number,
): boolean {
  const message = findChatMessage(messages, { messageId, nr, authorId: editorId });
  return !!message && message.id === editorId;
}

export function applyChatEdit(
  messages: ChatMessage[],
  ref: ChatMessageRef,
  text: string,
  editedAt: number,
): ChatMessage[] {
  const current = findChatMessage(messages, ref);
  if (!current) return messages;
  const idx = messages.indexOf(current);
  if (idx < 0) return messages;
  if (current.text === text) return messages;
  const history = [...(current.history ?? []), current.text];
  const next = [...messages];
  next[idx] = { ...current, text, editedAt, history };
  return next;
}

export function createChatMessage(
  senderId: string,
  text: string,
  nr: number,
  messageId?: string,
): ChatMessage {
  return {
    id: senderId,
    text,
    nr,
    messageId: messageId ?? `m-${nr}-${senderId}`,
    history: [],
  };
}
