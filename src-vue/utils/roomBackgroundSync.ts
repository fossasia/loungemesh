/** Safe XMPP payload size — large data URLs must be split to avoid XML parse errors. */
export const ROOM_BACKGROUND_CHUNK_SIZE = 2400;

export type RoomBackgroundCommand =
  | { action: 'clear' }
  | { action: 'reload' }
  | { action: 'begin'; total: number }
  | { action: 'chunk'; index: number; data: string };

export function buildRoomBackgroundCommands(
  url: string,
  options?: { chunkDirect?: boolean },
): RoomBackgroundCommand[] {
  if (!url) return [{ action: 'clear' }];
  if (options?.chunkDirect) {
    const chunks: RoomBackgroundCommand[] = [];
    for (let i = 0; i < url.length; i += ROOM_BACKGROUND_CHUNK_SIZE) {
      chunks.push({
        action: 'chunk',
        index: chunks.length,
        data: url.slice(i, i + ROOM_BACKGROUND_CHUNK_SIZE),
      });
    }
    return [{ action: 'begin', total: chunks.length }, ...chunks];
  }
  return [{ action: 'reload' }];
}

export function isRoomBackgroundCommand(value: unknown): value is RoomBackgroundCommand {
  if (!value || typeof value !== 'object') return false;
  const cmd = value as Record<string, unknown>;
  if (cmd.action === 'clear' || cmd.action === 'reload') return true;
  if (cmd.action === 'begin') return typeof cmd.total === 'number' && cmd.total > 0;
  if (cmd.action === 'chunk') {
    return typeof cmd.index === 'number' && cmd.index >= 0 && typeof cmd.data === 'string';
  }
  return false;
}
