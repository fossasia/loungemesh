import { describe, expect, it } from 'vitest';
import {
  ROOM_BACKGROUND_CHUNK_SIZE,
  buildRoomBackgroundCommands,
  isRoomBackgroundCommand,
} from './roomBackgroundSync';

describe('roomBackgroundSync', () => {
  it('builds reload and chunked commands for wallpapers', () => {
    const url = 'data:image/jpeg;base64,aaaa';
    const commands = buildRoomBackgroundCommands(url);
    expect(commands[0]).toEqual({ action: 'reload' });
    expect(buildRoomBackgroundCommands('')).toEqual([{ action: 'clear' }]);

    const largeUrl = 'x'.repeat(ROOM_BACKGROUND_CHUNK_SIZE + 10);
    const chunked = buildRoomBackgroundCommands(largeUrl, { chunkDirect: true });
    expect(chunked).toEqual([
      { action: 'begin', total: 2 },
      { action: 'chunk', index: 0, data: 'x'.repeat(ROOM_BACKGROUND_CHUNK_SIZE) },
      { action: 'chunk', index: 1, data: 'x'.repeat(10) },
    ]);
  });

  it('validates room background commands', () => {
    expect(isRoomBackgroundCommand({ action: 'clear' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'reload' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'begin', total: 2 })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'begin', total: 0 })).toBe(false);
    expect(isRoomBackgroundCommand({ action: 'begin', total: '2' })).toBe(false);
    expect(isRoomBackgroundCommand({ action: 'chunk', index: 0, data: 'abc' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'chunk', index: -1, data: 'abc' })).toBe(false);
    expect(isRoomBackgroundCommand({ action: 'chunk', index: 0, data: 123 })).toBe(false);
    expect(isRoomBackgroundCommand({ action: 'unknown' })).toBe(false);
    expect(isRoomBackgroundCommand(null)).toBe(false);
    expect(isRoomBackgroundCommand('reload')).toBe(false);
  });
});
