import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from './conferenceStore';
describe('conferenceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initialises with default state', () => {
    const store = useConferenceStore();
    expect(store.isJoined).toBe(false);
    expect(store.isJoining).toBe(false);
    expect(store.users).toEqual({});
    expect(store.messages).toEqual([]);
  });

  it('addUser creates a user with defaults', () => {
    const store = useConferenceStore();
    store.addUser('u1');
    expect(store.users['u1']).toMatchObject({
      id: 'u1',
      mute: false,
      volume: 1,
      pos: { x: 0, y: 0 },
      properties: {},
    });
  });

  it('addUser merges extra user data', () => {
    const store = useConferenceStore();
    store.addUser('u2', { _displayName: 'Alice' });
    expect((store.users['u2'] as { user?: unknown }).user).toMatchObject({ _displayName: 'Alice' });
  });

  it('removeUser deletes the entry', () => {
    const store = useConferenceStore();
    store.addUser('u3');
    store.removeUser('u3');
    expect(store.users['u3']).toBeUndefined();
  });

  it('updateUserPosition mutates pos in place', () => {
    const store = useConferenceStore();
    store.addUser('u4');
    store.updateUserPosition('u4', { x: 100, y: 200 });
    expect(store.users['u4'].pos).toEqual({ x: 100, y: 200 });
  });

  it('updateUserPosition is a no-op for unknown user', () => {
    const store = useConferenceStore();
    expect(() => store.updateUserPosition('ghost', { x: 1, y: 2 })).not.toThrow();
  });

  it('setConferenceName updates the name', () => {
    const store = useConferenceStore();
    store.setConferenceName('my-room');
    expect(store.conferenceName).toBe('my-room');
  });

  it('setDisplayName updates display name', () => {
    const store = useConferenceStore();
    store.setDisplayName('Alice');
    expect(store.displayName).toBe('Alice');
  });

  it('sendTextMessage delegates to media engine', () => {
    const store = useConferenceStore();
    const spy = vi.spyOn(getMediaEngineInstance(), 'sendTextMessage');
    store.sendTextMessage('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });

  it('leaveConference resets state', () => {
    const store = useConferenceStore();
    store.addUser('u5');
    store.isJoined = true;
    store.messages = [{ id: 'u5', text: 'hi', nr: 1 }];
    store.leaveConference();
    expect(store.isJoined).toBe(false);
    expect(store.users).toEqual({});
    expect(store.messages).toEqual([]);
  });
});
