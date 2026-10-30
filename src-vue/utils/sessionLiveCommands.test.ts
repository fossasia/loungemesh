import { describe, expect, it } from 'vitest';
import {
  isStickyPresenceCommand,
  liveCommandPayload,
  readLiveCommand,
  LIVE_COMMAND_TYPE,
} from './sessionLiveCommands';

describe('sessionLiveCommands', () => {
  it('keeps only small room state in presence', () => {
    expect(isStickyPresenceCommand('pos')).toBe(true);
    expect(isStickyPresenceCommand('hand')).toBe(true);
    expect(isStickyPresenceCommand('notes')).toBe(false);
    expect(isStickyPresenceCommand('wb')).toBe(false);
    expect(isStickyPresenceCommand('')).toBe(false);
  });

  it('wraps and reads live command payloads', () => {
    const payload = liveCommandPayload('notes', '{"action":"clear"}');
    expect(payload.type).toBe(LIVE_COMMAND_TYPE);
    expect(readLiveCommand(payload)).toEqual({ name: 'notes', value: '{"action":"clear"}' });
  });

  it('rejects payloads that are not live commands', () => {
    expect(readLiveCommand(null)).toBeNull();
    expect(readLiveCommand('notes')).toBeNull();
    expect(readLiveCommand({ type: 'other', name: 'notes', value: '{}' })).toBeNull();
    expect(readLiveCommand({ type: LIVE_COMMAND_TYPE, name: '', value: '{}' })).toBeNull();
    expect(readLiveCommand({ type: LIVE_COMMAND_TYPE, name: 'notes', value: 1 })).toBeNull();
    expect(readLiveCommand({ type: LIVE_COMMAND_TYPE, value: '{}' })).toBeNull();
  });
});
