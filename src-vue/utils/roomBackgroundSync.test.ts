import { describe, expect, it } from 'vitest';
import {
  buildRoomBackgroundCommands,
  isRoomBackgroundCommand,
} from './roomBackgroundSync';

describe('roomBackgroundSync', () => {
  it('builds reload commands for wallpapers', () => {
    const url = 'data:image/jpeg;base64,aaaa';
    const commands = buildRoomBackgroundCommands(url);
    expect(commands[0]).toEqual({ action: 'reload' });
    expect(buildRoomBackgroundCommands('')).toEqual([{ action: 'clear' }]);
  });

  it('validates room background commands', () => {
    expect(isRoomBackgroundCommand({ action: 'clear' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'reload' })).toBe(true);
    expect(isRoomBackgroundCommand({ action: 'unknown' })).toBe(false);
    expect(isRoomBackgroundCommand(null)).toBe(false);
  });
});
