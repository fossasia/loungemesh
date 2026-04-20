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

export function canEditChatMessage(
  message: ChatMessage,
  localUserId: string,
  isModerator: boolean,
): boolean {
  if (isModerator) return true;
  return message.id === localUserId;
}

export function applyChatEdit(
  messages: ChatMessage[],
  messageId: string,
  text: string,
  editedAt: number,
): ChatMessage[] {
  const idx = messages.findIndex((m) => m.messageId === messageId);
  if (idx < 0) return messages;
  const current = messages[idx];
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
