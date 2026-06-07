import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { setActivePinia, createPinia } from 'pinia';
import { spheresOverlap } from '@/constants/pan';
import { useLocalStore } from './localStore';
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

  it('patchUser is a no-op for an unknown user', () => {
    const store = useConferenceStore();
    const epochBefore = store.usersEpoch;
    store.patchUser('ghost', { mute: true });
    expect(store.users.ghost).toBeUndefined();
    expect(store.usersEpoch).toBe(epochBefore);
  });

  it('addUser keeps an existing entry when re-added without a display name', () => {
    const store = useConferenceStore();
    store.addUser('u9', { _displayName: 'Dana' });
    store.addUser('u9');
    expect(store.users.u9.user?._displayName).toBe('Dana');
    expect(Object.keys(store.users)).toHaveLength(1);
  });

  it('clearUserTrack, removeUser and updateUserDisplayName ignore unknown or blank input', () => {
    const store = useConferenceStore();
    expect(() => store.clearUserTrack('ghost', 'video')).not.toThrow();
    expect(() => store.removeUser('ghost')).not.toThrow();
    store.addUser('u10', { _displayName: 'Eve' });
    store.updateUserDisplayName('u10', '   ');
    store.updateUserDisplayName('ghost', 'Frank');
    expect(store.users.u10.user?._displayName).toBe('Eve');
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

  it('setUserTrack ignores muted camera video', () => {
    const store = useConferenceStore();
    store.addUser('u-muted-vid');
    store.setUserTrack('u-muted-vid', 'video', {
      getType: () => 'video',
      isMuted: () => true,
      videoType: 'camera',
    } as never);
    expect(store.users['u-muted-vid'].video).toBeUndefined();
  });

  it('setUserTrack replaces user entry for reactivity', () => {
    const store = useConferenceStore();
    store.addUser('u6');
    const epochBefore = store.usersEpoch;
    const before = store.users.u6;
    store.setUserTrack('u6', 'video', {
      getType: () => 'video',
      isMuted: () => false,
      videoType: 'camera',
    } as never);
    expect(store.usersEpoch).toBeGreaterThan(epochBefore);
    expect(store.users.u6).not.toBe(before);
    expect(store.users.u6.video).toBeTruthy();
  });

  it('setUserTrack is a no-op for an unknown user', () => {
    const store = useConferenceStore();
    const epochBefore = store.usersEpoch;
    store.setUserTrack('ghost', 'audio', {
      getType: () => 'audio',
      isMuted: () => false,
    } as never);
    expect(store.users.ghost).toBeUndefined();
    expect(store.usersEpoch).toBe(epochBefore);
  });

  it('clearUserTrack removes media from a user', () => {
    const store = useConferenceStore();
    store.addUser('u7');
    store.setUserTrack('u7', 'video', {
      getType: () => 'video',
      isMuted: () => false,
      videoType: 'camera',
    } as never);
    store.clearUserTrack('u7', 'video');
    expect(store.users.u7.video).toBeUndefined();
  });

  it('setUserTrack and clearUserTrack handle screenshare desktop tracks separately', () => {
    const store = useConferenceStore();
    store.addUser('u-screen');
    const track = {
      getType: () => 'video',
      isMuted: () => false,
      videoType: 'desktop',
    } as never;
    store.setUserTrack('u-screen', 'video', track);
    expect(store.users['u-screen'].screenshare).toBe(track);
    expect(store.users['u-screen'].video).toBeUndefined();

    store.clearUserTrack('u-screen', 'screenshare');
    expect(store.users['u-screen'].screenshare).toBeUndefined();
  });

  it('setUserTrack handles muted screenshare by clearing screenshare', () => {
    const store = useConferenceStore();
    store.addUser('u-screen-mute');
    store.users['u-screen-mute'].screenshare = { getType: () => 'video' } as never;
    store.setUserTrack('u-screen-mute', 'video', {
      getType: () => 'video',
      isMuted: () => true,
      videoType: 'desktop',
    } as never);
    expect(store.users['u-screen-mute'].screenshare).toBeUndefined();
  });

  it('clearUserTrack removes audio and unmutes the user', () => {
    const store = useConferenceStore();
    store.addUser('u8');
    store.setUserTrack('u8', 'audio', {
      getType: () => 'audio',
      isMuted: () => true,
    } as never);
    expect(store.users.u8.audio).toBeTruthy();
    expect(store.users.u8.mute).toBe(true);
    store.clearUserTrack('u8', 'audio');
    expect(store.users.u8.audio).toBeUndefined();
    expect(store.users.u8.mute).toBe(false);
  });

  it('updateUserDisplayName updates remote user label', () => {
    const store = useConferenceStore();
    store.addUser('u2', { _displayName: 'Alice' });
    store.updateUserDisplayName('u2', 'Bob');
    expect(store.users.u2.user?._displayName).toBe('Bob');
  });

  it('addUser avoids overlapping the local sphere', () => {
    const store = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('me');
    local.pos = { x: 2900, y: 2900 };
    store.addUser('remote');
    expect(spheresOverlap(local.pos, store.users.remote.pos)).toBe(false);
  });

  it('addUser refreshes display name when user already exists', () => {
    const store = useConferenceStore();
    store.addUser('u2', { _displayName: 'Alice' });
    store.addUser('u2', { _displayName: 'Carol' });
    expect(store.users.u2.user?._displayName).toBe('Carol');
    expect(Object.keys(store.users)).toHaveLength(1);
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
