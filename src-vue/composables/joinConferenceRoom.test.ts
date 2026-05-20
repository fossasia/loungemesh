import { describe, expect, it, vi } from 'vitest';
import { runConferenceJoin, shouldSkipConferenceJoin } from './joinConferenceRoom';

describe('shouldSkipConferenceJoin', () => {
  it('returns true only when a join is already in progress', () => {
    expect(shouldSkipConferenceJoin({ isJoining: true })).toBe(true);
    expect(shouldSkipConferenceJoin({ isJoining: false })).toBe(false);
  });
});

describe('runConferenceJoin', () => {
  it('joins and stores the conference object', async () => {
    const store = { isJoining: false, conferenceObject: undefined as unknown };
    const engine = {
      joinRoom: vi.fn().mockResolvedValue(undefined),
      getConference: vi.fn().mockReturnValue({ id: 'conf' }),
      isJoined: vi.fn().mockReturnValue(true),
    };
    await runConferenceJoin(engine, store, 'room', 'Alice', {});
    expect(store.isJoining).toBe(true);
    expect(store.conferenceObject).toEqual({ id: 'conf' });
    expect(engine.joinRoom).toHaveBeenCalledWith('room', 'Alice', {});
  });

  it('leaves conferenceObject untouched when no conference is available', async () => {
    const store = { isJoining: false, conferenceObject: undefined as unknown };
    const engine = {
      joinRoom: vi.fn().mockResolvedValue(undefined),
      getConference: vi.fn().mockReturnValue(undefined),
      isJoined: vi.fn().mockReturnValue(false),
    };
    await runConferenceJoin(engine, store, 'room', 'Alice', {});
    expect(store.isJoining).toBe(true);
    expect(store.conferenceObject).toBeUndefined();
  });

  it('clears isJoining and rethrows on failure', async () => {
    const store = { isJoining: false, conferenceObject: undefined as unknown };
    const engine = {
      joinRoom: vi.fn().mockRejectedValue(new Error('join failed')),
      getConference: vi.fn().mockReturnValue(undefined),
      isJoined: vi.fn(),
    };
    await expect(runConferenceJoin(engine, store, 'room', 'Alice', {})).rejects.toThrow('join failed');
    expect(store.isJoining).toBe(false);
  });
});
