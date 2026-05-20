import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { handleSessionConnectionWatch } from './sessionConnectionWatch';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function runWatch(
  roomId: string,
  connected: boolean,
  deps: Parameters<typeof handleSessionConnectionWatch>[2],
) {
  const p = handleSessionConnectionWatch(roomId, connected, deps);
  await vi.advanceTimersByTimeAsync(800);
  await p;
}

function makeDeps(overrides: Partial<Parameters<typeof handleSessionConnectionWatch>[2]> = {}) {
  const conferenceStore = {
    error: undefined as string | undefined,
    isJoining: false,
    isJoined: false,
    conferenceName: '',
    conferenceObject: undefined as unknown,
    displayName: 'Alice',
    setConferenceName: vi.fn((name: string) => {
      conferenceStore.conferenceName = name;
    }),
    leaveConference: vi.fn(() => {
      conferenceStore.isJoined = false;
      conferenceStore.conferenceObject = undefined;
    }),
  };
  const deps = {
    connect: vi.fn().mockResolvedValue(undefined),
    joinRoom: vi.fn().mockResolvedValue(undefined),
    leaveRoom: vi.fn(),
    conferenceStore,
    engine: { getConference: vi.fn(() => ({ id: 'conf' })) } as never,
    conferenceOptions: {},
    ...overrides,
  };
  return { deps, conferenceStore };
}

describe('handleSessionConnectionWatch', () => {
  it('returns immediately for an empty room id', async () => {
    const { deps } = makeDeps();
    await handleSessionConnectionWatch('', false, deps);
    expect(deps.connect).not.toHaveBeenCalled();
    expect(deps.joinRoom).not.toHaveBeenCalled();
  });

  it('connects when not yet connected', async () => {
    const { deps } = makeDeps();
    await handleSessionConnectionWatch('room-a', false, deps);
    expect(deps.connect).toHaveBeenCalled();
    expect(deps.joinRoom).not.toHaveBeenCalled();
  });

  it('records connect failures', async () => {
    const { deps, conferenceStore } = makeDeps({
      connect: vi.fn().mockRejectedValue('offline'),
    });
    await handleSessionConnectionWatch('room-a', false, deps);
    expect(conferenceStore.error).toBe('offline');
  });

  it('skips join when already joining, joined, or conference exists', async () => {
    const joining = makeDeps();
    joining.conferenceStore.isJoining = true;
    await handleSessionConnectionWatch('room-a', true, joining.deps);
    expect(joining.deps.joinRoom).not.toHaveBeenCalled();

    const joined = makeDeps();
    joined.conferenceStore.isJoined = true;
    joined.conferenceStore.conferenceName = 'room-a';
    await handleSessionConnectionWatch('room-a', true, joined.deps);
    expect(joined.deps.joinRoom).not.toHaveBeenCalled();
  });

  it('switches rooms and joins when connected', async () => {
    const resetSessionForJoin = vi.fn();
    const { deps, conferenceStore } = makeDeps({
      resetSessionForJoin,
      engine: {
        getConference: vi.fn(() => ({ id: 'conf' })),
        isJoined: vi.fn(() => true),
      } as never,
    });
    conferenceStore.isJoined = true;
    conferenceStore.conferenceName = 'room-a';
    await runWatch('room-b', true, deps);
    expect(resetSessionForJoin).toHaveBeenCalled();
    expect(deps.leaveRoom).toHaveBeenCalled();
    expect(deps.joinRoom).toHaveBeenCalledWith('room-b', 'Alice', {});
    expect(conferenceStore.conferenceObject).toEqual({ id: 'conf' });
  });

  it('does not set the conference object when the engine has none after join', async () => {
    const { deps, conferenceStore } = makeDeps({
      engine: { getConference: vi.fn(() => undefined) } as never,
    });
    await runWatch('room-b', true, deps);
    expect(deps.joinRoom).toHaveBeenCalled();
    expect(conferenceStore.conferenceObject).toBeUndefined();
  });

  it('records non-Error join failures', async () => {
    const { deps, conferenceStore } = makeDeps({
      joinRoom: vi.fn().mockRejectedValue('offline'),
    });
    await runWatch('room-z', true, deps);
    expect(conferenceStore.error).toBe('offline');
    expect(conferenceStore.isJoining).toBe(false);
  });

  it('records Error join failures', async () => {
    const { deps, conferenceStore } = makeDeps({
      joinRoom: vi.fn().mockRejectedValue(new Error('join failed')),
    });
    await runWatch('room-z', true, deps);
    expect(conferenceStore.error).toBe('join failed');
    expect(conferenceStore.isJoining).toBe(false);
  });

  it('records Error connect failures', async () => {
    const { deps, conferenceStore } = makeDeps({
      connect: vi.fn().mockRejectedValue(new Error('connect failed')),
    });
    await handleSessionConnectionWatch('room-a', false, deps);
    expect(conferenceStore.error).toBe('connect failed');
  });
});
