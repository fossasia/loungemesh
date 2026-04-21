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
      pos: { x: 2900, y: 2900 },
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
    const spy = vi.spyOn(getMediaEngineInstance(), 'sendTextMessage').mockReturnValue(true);
    expect(store.sendTextMessage('hello')).toBe(true);
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });

  it('ingests chat messages and replaces optimistic sends', () => {
    const store = useConferenceStore();
    store.appendChatMessage({
      id: 'me',
      text: 'hi',
      nr: -1,
      messageId: 'm-local',
      history: [],
    });
    store.ingestChatMessage('me', 'hi', 42);
    expect(store.messages[0]).toMatchObject({ id: 'me', text: 'hi', nr: 42 });
    store.ingestChatMessage('me', 'hi', 42);
    expect(store.messages).toHaveLength(1);
    store.editChatMessage(store.messages[0].messageId, 'edited', 99);
    expect(store.messages[0].text).toBe('edited');
    expect(store.messages[0].history).toEqual(['hi']);
    store.ingestChatMessage('other', 'yo', 43);
    expect(store.messages).toHaveLength(2);
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
