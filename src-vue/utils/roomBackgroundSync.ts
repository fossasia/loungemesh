/** Safe XMPP payload size — large data URLs must be split to avoid XML parse errors. */
export const ROOM_BACKGROUND_CHUNK_SIZE = 2400;

export type RoomBackgroundCommand =
  | { action: 'clear' }
  | { action: 'reload' };

export function buildRoomBackgroundCommands(url: string): RoomBackgroundCommand[] {
  if (!url) return [{ action: 'clear' }];
  return [{ action: 'reload' }];
}

export function isRoomBackgroundCommand(value: unknown): value is RoomBackgroundCommand {
  if (!value || typeof value !== 'object') return false;
  const action = (value as RoomBackgroundCommand).action;
  return action === 'clear' || action === 'reload';
}
