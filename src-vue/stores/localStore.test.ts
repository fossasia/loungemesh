import { describe, expect, it, beforeEach, vi } from 'vitest';
import { toRaw } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useLocalStore } from './localStore';
import { useConferenceStore } from './conferenceStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

describe('localStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('expands room bounds when users move far from the center', () => {
    const store = useLocalStore();
    const conference = useConferenceStore();
    const initialW = store.roomBounds.size.x;
    store.setLocalPosition({ x: 20000, y: 20000 });
    expect(store.roomBounds.size.x).toBeGreaterThan(initialW);
    conference.addUser('peer');
    store.ensureRoomBounds();
    expect(store.roomBounds.size.x).toBeGreaterThanOrEqual(initialW);
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

  it('setLocalTracks disposes camera tracks while camera is off', () => {
    const dispose = vi.fn();
    const store = useLocalStore();
    store.cameraOff = true;
    store.setLocalTracks([
      { getType: () => 'video', videoType: 'camera', dispose } as never,
    ]);
    expect(store.video).toBeUndefined();
    expect(dispose).toHaveBeenCalled();
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

  it('resetViewportForRoom spreads away from peers already in the room', () => {
    vi.useFakeTimers();
    const conference = useConferenceStore();
    const store = useLocalStore();
    conference.addUser('peer');
    const peerPos = { ...conference.users.peer.pos };
    store.resetViewportForRoom();
    vi.runAllTimers();
    vi.useRealTimers();
    expect(store.pos.x !== peerPos.x || store.pos.y !== peerPos.y).toBe(true);
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

    expect(store.usersOnStage).toContain('u1');
    // Bridge channel is enabled ('datachannel'), so receiver constraints are sent
    // to JVB — without this, remote video is never forwarded and tiles stay black.
    expect(constraintsSpy).toHaveBeenCalledTimes(1);
    const sent = constraintsSpy.mock.calls[0][0];
    expect(sent.selectedSources).toEqual(expect.arrayContaining(['u1-v0']));
    expect(sent).not.toHaveProperty('colibriClass');
    constraintsSpy.mockRestore();
  });

  it('toggleMute releases the mic on mute and re-acquires it on unmute', async () => {
    const existing = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      unmute: vi.fn().mockResolvedValue(undefined),
      mute: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getOriginalStream: () => ({ getTracks: () => [{ stop: vi.fn() }] }),
    };
    const fresh = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      unmute: vi.fn().mockResolvedValue(undefined),
      mute: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalTracks: () => [],
      removeTrack,
    } as never);
    const createSpy = vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([fresh as never]);
    const addSpy = vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    const refreshSpy = vi.spyOn(engine, 'refreshRemoteAudio');

    const store = useLocalStore();
    store.audio = existing as never;
    store.mute = false;

    await store.toggleMute();
    expect(existing.mute).toHaveBeenCalled();
    expect(store.mute).toBe(true);
    expect(store.audio).toBeUndefined();
    expect(removeTrack).toHaveBeenCalledWith(existing);
    expect(existing.dispose).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();

    await store.toggleMute();
    expect(store.mute).toBe(false);
    expect(createSpy).toHaveBeenCalledWith(['audio']);
    expect(addSpy).toHaveBeenCalledWith(fresh);
    expect(toRaw(store.audio)).toBe(fresh);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('disableMic fully releases the mic', async () => {
    const existing = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getOriginalStream: () => ({ getTracks: () => [{ stop: vi.fn() }] }),
    };
    const engine = getMediaEngineInstance();
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalTracks: () => [],
      removeTrack,
    } as never);
    const store = useLocalStore();
    store.audio = existing as never;
    store.mute = false;
    await store.disableMic();
    expect(existing.mute).toHaveBeenCalled();
    expect(store.mute).toBe(true);
    expect(store.audio).toBeUndefined();
    expect(removeTrack).toHaveBeenCalledWith(existing);
    expect(existing.dispose).toHaveBeenCalled();
  });

  it('disableMic skips mute when the track is already muted', async () => {
    const track = {
      isMuted: vi.fn().mockReturnValue(true),
      mute: vi.fn(),
    };
    const store = useLocalStore();
    store.audio = track as never;
    store.mute = false;
    await store.disableMic();
    expect(track.mute).not.toHaveBeenCalled();
    expect(store.mute).toBe(true);
  });

  it('disableMic tolerates mute failures', async () => {
    const track = {
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn().mockRejectedValue(new Error('gone')),
    };
    const store = useLocalStore();
    store.audio = track as never;
    await store.disableMic();
    expect(store.mute).toBe(true);
  });

  it('enableMic skips unmute when the new track is already live', async () => {
    const created = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      unmute: vi.fn(),
      mute: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([created as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    vi.spyOn(engine, 'getConference').mockReturnValue({ getLocalTracks: () => [] } as never);
    vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    const store = useLocalStore();
    store.mute = true;
    await store.enableMic();
    expect(created.unmute).not.toHaveBeenCalled();
    expect(store.mute).toBe(false);
  });

  it('enableMic unmutes a created track that starts muted while joined', async () => {
    const created = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(true),
      unmute: vi.fn().mockResolvedValue(undefined),
      mute: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([created as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    vi.spyOn(engine, 'getConference').mockReturnValue({ getLocalTracks: () => [] } as never);
    vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    const store = useLocalStore();
    store.mute = true;
    await store.enableMic();
    expect(created.unmute).toHaveBeenCalled();
    expect(store.mute).toBe(false);
  });

  it('enableMic just unmutes an existing live track', async () => {
    const track = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(true),
      unmute: vi.fn().mockResolvedValue(undefined),
      mute: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    const createSpy = vi.spyOn(engine, 'createLocalTracks');
    const store = useLocalStore();
    store.audio = track as never;
    store.mute = true;
    await store.toggleMute();
    expect(track.unmute).toHaveBeenCalled();
    expect(store.mute).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('unmute exits when track creation fails', async () => {
    const engine = getMediaEngineInstance();
    const createSpy = vi.spyOn(engine, 'createLocalTracks').mockRejectedValue(new Error('denied'));
    const store = useLocalStore();
    store.mute = true;
    await store.toggleMute();
    expect(store.audio).toBeUndefined();
    expect(store.mute).toBe(true);
    createSpy.mockRestore();
  });

  it('unmute returns when created track is not audio', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([{ getType: () => 'video' } as never]);
    const store = useLocalStore();
    store.mute = true;
    await store.toggleMute();
    expect(store.audio).toBeUndefined();
  });

  it('unmute stays muted when publishing the new track fails', async () => {
    const track = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn(),
      unmute: vi.fn(),
      dispose: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([track as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    vi.spyOn(engine, 'getConference').mockReturnValue({ getLocalTracks: () => [] } as never);
    vi.spyOn(engine, 'addLocalTrack').mockRejectedValue(new Error('publish failed'));
    const store = useLocalStore();
    store.mute = true;
    await store.toggleMute();
    expect(store.mute).toBe(true);
    expect(store.audio).toBeUndefined();
    expect(track.dispose).toHaveBeenCalled();
  });

  it('unmute skips addLocalTrack when not joined', async () => {
    const track = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(true),
      unmute: vi.fn(),
      mute: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([track as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(false);
    const addSpy = vi.spyOn(engine, 'addLocalTrack');
    const store = useLocalStore();
    store.mute = true;
    await store.toggleMute();
    expect(addSpy).not.toHaveBeenCalled();
    expect(store.mute).toBe(false);
  });

  it('unmute returns when createLocalTracks returns empty', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([]);
    const store = useLocalStore();
    store.mute = true;
    await store.toggleMute();
    expect(store.audio).toBeUndefined();
  });

  it('toggleCamera enables and disables the camera track', async () => {
    const video = {
      getType: () => 'video',
      videoType: 'camera',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn().mockResolvedValue(undefined),
      unmute: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    const store = useLocalStore();
    store.video = video as never;
    store.cameraOff = false;
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    await store.toggleCamera();
    expect(store.cameraOff).toBe(true);
    expect(store.video).toBeUndefined();
    expect(video.dispose).toHaveBeenCalled();

    const created = {
      getType: () => 'video',
      videoType: 'camera',
      isMuted: vi.fn().mockReturnValue(false),
      unmute: vi.fn(),
    };
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([created as never]);
    vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    await store.toggleCamera();
    expect(store.cameraOff).toBe(false);
    expect(store.video).toStrictEqual(created);
  });

  it('enableCamera unmute path when camera track already exists', async () => {
    const video = {
      getType: () => 'video',
      videoType: 'camera',
      isMuted: vi.fn().mockReturnValue(true),
      unmute: vi.fn().mockResolvedValue(undefined),
    };
    const store = useLocalStore();
    store.video = video as never;
    store.cameraOff = true;
    await store.enableCamera();
    expect(store.cameraOff).toBe(false);
    expect(video.unmute).toHaveBeenCalled();
  });

  it('enableCamera reuses an unmuted camera without calling unmute', async () => {
    const video = {
      getType: () => 'video',
      videoType: 'camera',
      isMuted: vi.fn().mockReturnValue(false),
      unmute: vi.fn(),
    };
    const store = useLocalStore();
    store.video = video as never;
    store.cameraOff = true;
    await store.enableCamera();
    expect(store.cameraOff).toBe(false);
    expect(video.unmute).not.toHaveBeenCalled();
  });

  it('enableCamera skips conference add when not joined', async () => {
    const created = { getType: () => 'video', videoType: 'camera' };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([created as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(false);
    const addSpy = vi.spyOn(engine, 'addLocalTrack');
    const store = useLocalStore();
    await store.enableCamera();
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('enableCamera adds track to conference when joined', async () => {
    const stale = {
      getType: () => 'video',
      dispose: vi.fn(),
    };
    const created = {
      getType: () => 'video',
      videoType: 'camera',
      isMuted: vi.fn().mockReturnValue(false),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([created as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalTracks: () => [stale],
      removeTrack,
    } as never);
    const addSpy = vi.spyOn(engine, 'addLocalTrack').mockResolvedValue(undefined);
    const store = useLocalStore();
    await store.enableCamera();
    expect(removeTrack).toHaveBeenCalledWith(stale);
    expect(stale.dispose).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith(created);
  });

  it('enableCamera ignores addLocalTrack failures and creation errors', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks')
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce([]);
    const store = useLocalStore();
    await store.enableCamera();
    await store.enableCamera();
    expect(store.video).toBeUndefined();
  });

  it('enableCamera disposes the new track when conference add fails while joined', async () => {
    const created = {
      getType: () => 'video',
      videoType: 'camera',
      isMuted: vi.fn().mockReturnValue(false),
      dispose: vi.fn(),
    };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([created as never]);
    vi.spyOn(engine, 'isJoined').mockReturnValue(true);
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalTracks: () => [],
      removeTrack: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.spyOn(engine, 'addLocalTrack').mockRejectedValue(new Error('add failed'));
    const store = useLocalStore();
    await store.enableCamera();
    expect(created.dispose).toHaveBeenCalled();
    expect(store.video).toBeUndefined();
  });

  it('disableCamera removes and disposes the current camera track', async () => {
    const video = {
      getType: () => 'video',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn(),
      dispose: vi.fn(),
    };
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue({ removeTrack } as never);
    const store = useLocalStore();
    store.video = video as never;
    await store.disableCamera();
    expect(removeTrack).toHaveBeenCalledWith(video);
    expect(video.dispose).toHaveBeenCalled();
    expect(store.video).toBeUndefined();
  });

  it('disableCamera stops the stream even when removeTrack fails', async () => {
    const stop = vi.fn();
    const video = {
      getType: () => 'video',
      videoType: 'camera',
      dispose: vi.fn(),
      getOriginalStream: () => ({ getTracks: () => [{ stop }] }),
    };
    const removeTrack = vi.fn().mockRejectedValue(new Error('gone'));
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue({ removeTrack } as never);
    const store = useLocalStore();
    store.video = video as never;
    await store.disableCamera();
    expect(store.cameraOff).toBe(true);
    expect(stop).toHaveBeenCalled();
  });

  it('disableCamera stops raw tracks captured before preview detach', async () => {
    const stop = vi.fn();
    const video = {
      getType: () => 'video',
      videoType: 'camera',
      dispose: vi.fn(),
      getOriginalStream: () => ({ getTracks: () => [{ stop }] }),
      getTrack: () => ({ stop }),
    };
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue({ removeTrack } as never);
    const store = useLocalStore();
    store.video = video as never;
    await store.disableCamera();
    expect(stop).toHaveBeenCalled();
  });

  it('disableCamera without a video track only flips cameraOff', async () => {
    const store = useLocalStore();
    store.video = undefined;
    await store.disableCamera();
    expect(store.cameraOff).toBe(true);
  });

  it('stopAllLocalMedia disposes tracks and marks devices off', async () => {
    const stop = vi.fn();
    const removeTrack = vi.fn().mockResolvedValue(undefined);
    const audio = {
      getType: () => 'audio',
      mute: vi.fn(),
      dispose: vi.fn(),
      getOriginalStream: () => ({ getTracks: () => [{ stop }] }),
    };
    const video = { getType: () => 'video', mute: vi.fn(), dispose: vi.fn() };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue({ removeTrack } as never);
    const store = useLocalStore();
    store.audio = audio as never;
    store.video = video as never;
    await store.stopAllLocalMedia();
    expect(store.audio).toBeUndefined();
    expect(store.video).toBeUndefined();
    expect(store.cameraOff).toBe(true);
    expect(store.mute).toBe(true);
    expect(stop).toHaveBeenCalled();
    expect(removeTrack).toHaveBeenCalledTimes(2);
    expect(audio.dispose).toHaveBeenCalled();
    expect(video.dispose).toHaveBeenCalled();
  });

  it('stopAllLocalMedia works when not joined to a conference', async () => {
    const audio = { getType: () => 'audio', dispose: vi.fn() };
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'isJoined').mockReturnValue(false);
    const store = useLocalStore();
    store.audio = audio as never;
    await store.stopAllLocalMedia();
    expect(store.audio).toBeUndefined();
    expect(audio.dispose).toHaveBeenCalled();
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

  it('calculateUsersOnScreen skips receiver constraints when the bridge channel is off', async () => {
    const { conferenceOptions } = await import('@/config/jitsiOptions');
    const original = conferenceOptions.openBridgeChannel;
    conferenceOptions.openBridgeChannel = '' as never;
    const conference = useConferenceStore();
    conference.addUser('u1');
    const engine = getMediaEngineInstance();
    const constraintsSpy = vi.spyOn(engine, 'setReceiverConstraints');
    const store = useLocalStore();
    store.id = 'me';
    store.calculateUsersOnScreen();
    expect(constraintsSpy).not.toHaveBeenCalled();
    constraintsSpy.mockRestore();
    conferenceOptions.openBridgeChannel = original;
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
