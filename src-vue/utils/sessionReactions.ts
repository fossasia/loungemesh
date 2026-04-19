/** Send a reaction command when a local participant id is known. */
export function sendSessionReaction(
  localId: string,
  engineUserId: string | undefined,
  emoji: string,
  setReaction: (id: string, emoji: string) => void,
  sendCommand: (cmd: string, json: string) => void,
  closePanel: () => void,
): void {
  const id = localId || engineUserId;
  if (!id) return;
  setReaction(id, emoji);
  sendCommand('react', JSON.stringify({ id, emoji }));
  closePanel();
}
