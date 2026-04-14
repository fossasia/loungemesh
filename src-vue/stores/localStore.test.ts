import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLocalStore } from './localStore';
import { useConferenceStore } from './conferenceStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

describe('localStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates position, pan, and stage flags', () => {
    const store = useLocalStore();
    store.setMyID('me');
    store.setLocalPosition({ x: 10, y: 20 });
    store.setPanZoom({ pan: { x: 5, y: 6 }, scale: 2 });
    store.setOnStage(true);
    store.toggleStage();
    store.toggleStageMute();
    store.setSelectedUserOnStage('u1');
    store.setSelectedUserOnStage('u1');

    expect(store.id).toBe('me');
    expect(store.pos).toEqual({ x: 10, y: 20 });
    expect(store.onStage).toBe(true);
    expect(store.stageVisible).toBe(false);
    expect(store.selectedUsersOnStage).toEqual([]);
  });

  it('setLocalTracks assigns audio and video', () => {
    const store = useLocalStore();
    store.setLocalTracks([
      { getType: () => 'audio' } as never,
      { getType: () => 'video', videoType: 'desktop' } as never,
    ]);
    expect(store.audio).toBeTruthy();
    expect(store.videoType).toBe('desktop');
  });

  it('publishLocalPosition sends command when id is set', () => {
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    const store = useLocalStore();
    store.setMyID('me');
    store.publishLocalPosition();
    expect(cmdSpy).toHaveBeenCalledWith('pos', expect.stringContaining('"id":"me"'));
    cmdSpy.mockRestore();
  });

  it('publishLocalPosition no-ops without id', () => {
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    const store = useLocalStore();
    store.id = '';
    store.publishLocalPosition();
    expect(cmdSpy).not.toHaveBeenCalled();
    cmdSpy.mockRestore();
  });

  it('resetViewportForRoom centers the user', () => {
    vi.useFakeTimers();
    const store = useLocalStore();
    store.resetViewportForRoom();
    vi.runAllTimers();
    vi.useRealTimers();
    expect(store.scale).toBeGreaterThan(0);
  });

  it('resetViewportForRoom skips centering on tiny viewports', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { value: 100, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true });
    const store = useLocalStore();
    const before = store.scale;
    store.resetViewportForRoom();
    vi.runAllTimers();
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    vi.useRealTimers();
    expect(store.scale).toBe(before);
  });

  it('setLocalTracks ignores missing tracks', () => {
    const store = useLocalStore();
    store.setLocalTracks([{ getType: () => 'desktop' } as never]);
    expect(store.audio).toBeUndefined();
  });

  it('calculateUsersOnScreen updates constraints from DOM', () => {
    const conference = useConferenceStore();
    conference.addUser('u1');
    conference.users.u1.properties = { onStage: 'true' };
    conference.users.u1.pos = { x: 100, y: 100 };

    const el = document.createElement('div');
    el.id = 'u1';
    el.className = 'userContainer';
    document.body.appendChild(el);

    const engine = getMediaEngineInstance();
    const constraintsSpy = vi.spyOn(engine, 'setReceiverConstraints');

    const store = useLocalStore();
    store.id = 'me';
    store.onStage = true;
    store.calculateUsersOnScreen();

    expect(constraintsSpy).toHaveBeenCalled();
    expect(store.usersOnStage).toContain('u1');
    constraintsSpy.mockRestore();
  });

  it('toggleMute creates and toggles audio track', async () => {
    const track = {
      getType: () => 'audio',
      isMuted: vi.fn(),
      unmute: vi.fn().mockResolvedValue(undefined),
      mute: vi.fn().mockResolvedValue(undefined),
    };
    track.isMuted.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const engine = getMediaEngineInstance();
    const createSpy = vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([track as never]);
    const addSpy = vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    const joinedSpy = vi.spyOn(engine, 'isJoined').mockReturnValue(true);

    const store = useLocalStore();
    await store.toggleMute();
    expect(store.mute).toBe(false);

    await store.toggleMute();
    expect(store.mute).toBe(true);
    expect(track.mute).toHaveBeenCalled();

    createSpy.mockRestore();
    addSpy.mockRestore();
    joinedSpy.mockRestore();
  });

  it('toggleMute exits when track creation fails', async () => {
    const engine = getMediaEngineInstance();
    const createSpy = vi.spyOn(engine, 'createLocalTracks').mockRejectedValue(new Error('denied'));
    const store = useLocalStore();
    await store.toggleMute();
    expect(store.audio).toBeUndefined();
    createSpy.mockRestore();
  });

  it('toggleMute returns when created track is not audio', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([{ getType: () => 'video' } as never]);
    const store = useLocalStore();
    await store.toggleMute();
    expect(store.audio).toBeUndefined();
  });

  it('toggleMute swallows addLocalTrack errors when joined', async () => {
    const track = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn(),
      unmute: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([track as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    vi.spyOn(engine, 'addLocalTrack').mockRejectedValue(new Error('duplicate'));
    const store = useLocalStore();
    await store.toggleMute();
    expect(store.mute).toBe(true);
  });

  it('toggleMute returns when createLocalTracks returns empty', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([]);
    const store = useLocalStore();
    await store.toggleMute();
    expect(store.audio).toBeUndefined();
  });

  it('includes on-screen remote users in visibleUsers', () => {
    const conference = useConferenceStore();
    conference.addUser('on-screen');
    conference.users['on-screen'].pos = { x: 50, y: 50 };
    const el = document.createElement('div');
    el.id = 'on-screen';
    el.className = 'userContainer';
    el.getBoundingClientRect = () =>
      ({ x: 100, y: 100, width: 50, height: 50 }) as DOMRect;
    document.body.appendChild(el);

    const store = useLocalStore();
    store.id = 'me';
    store.onStage = true;
    store.calculateUsersOnScreen();
    expect(store.visibleUsers).toContain('on-screen');
    el.remove();
  });

  it('calculateUsersOnScreen skips elements without id', () => {
    const el = document.createElement('div');
    el.className = 'userContainer';
    document.body.appendChild(el);
    const store = useLocalStore();
    store.onStage = true;
    store.calculateUsersOnScreen();
    el.remove();
  });
});
