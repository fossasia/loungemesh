export type ChatUserRecord = { user?: { _displayName?: string } };

/** Resolve the label shown above a chat message for a participant id. */
export function displayNameForMessage(
  id: string,
  localId: string,
  users: Record<string, ChatUserRecord | undefined>,
): string {
  if (id && localId && id === localId) {
    return 'You';
  }
  const name = users[id]?.user?._displayName?.trim();
  return name || 'Guest';
}
