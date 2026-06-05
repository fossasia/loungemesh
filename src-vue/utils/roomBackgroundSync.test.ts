import { describe, expect, it } from 'vitest';
import {
  buildRoomBackgroundCommands,
  isRoomBackgroundCommand,
  ROOM_BACKGROUND_CHUNK_SIZE,
} from './roomBackgroundSync';

describe('roomBackgroundSync', () => {
  it('builds chunked commands for large wallpapers', () => {
    const url = 'data:image/jpeg;base64,' + 'a'.repeat(ROOM_BACKGROUND_CHUNK_SIZE + 10);
    const commands = buildRoomBackgroundCommands(url);
    expect(commands[0]).toEqual({ action: 'begin', total: 2 });
    expect(commands[1]).toEqual({
      action: 'chunk',
      index: 0,
      data: url.slice(0, ROOM_BACKGROUND_CHUNK_SIZE),
    });
    expect(commands[2]?.action).toBe('chunk');
    expect(buildRoomBackgroundCommands('')).toEqual([{ action: 'clear' }]);
  });

  it('validates room background commands', () => {
    expect(isRoomBackgroundCommand({ action: 'clear' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'begin', total: 2 })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'chunk', index: 0, data: 'abc' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'chunk', index: 0, data: 1 })).toBe(false);
    expect(isRoomBackgroundCommand({ action: 'begin', total: '2' })).toBe(false);
    expect(isRoomBackgroundCommand({ action: 'unknown' })).toBe(false);
    expect(isRoomBackgroundCommand(null)).toBe(false);
  });
});
