/** Safe XMPP payload size — large data URLs must be split to avoid XML parse errors. */
export const ROOM_BACKGROUND_CHUNK_SIZE = 2400;

export type RoomBackgroundCommand =
  | { action: 'clear' }
  | { action: 'begin'; total: number }
  | { action: 'chunk'; index: number; data: string };

export function buildRoomBackgroundCommands(url: string): RoomBackgroundCommand[] {
  if (!url) return [{ action: 'clear' }];
  const total = Math.ceil(url.length / ROOM_BACKGROUND_CHUNK_SIZE);
  const commands: RoomBackgroundCommand[] = [{ action: 'begin', total }];
  for (let index = 0, offset = 0; offset < url.length; index += 1, offset += ROOM_BACKGROUND_CHUNK_SIZE) {
    commands.push({
      action: 'chunk',
      index,
      data: url.slice(offset, offset + ROOM_BACKGROUND_CHUNK_SIZE),
    });
  }
  return commands;
}

export function isRoomBackgroundCommand(value: unknown): value is RoomBackgroundCommand {
  if (!value || typeof value !== 'object') return false;
  const action = (value as RoomBackgroundCommand).action;
  if (action === 'clear') return true;
  if (action === 'begin') {
    return typeof (value as { total?: unknown }).total === 'number';
  }
  if (action === 'chunk') {
    const chunk = value as { index?: unknown; data?: unknown };
    return typeof chunk.index === 'number' && typeof chunk.data === 'string';
  }
  return false;
}
