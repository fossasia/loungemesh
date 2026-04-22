import { describe, expect, it, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ensureLocalTracks } from './ensureLocalTracks';
import { useLocalStore } from '@/stores/localStore';

describe('ensureLocalTracks', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('requests audio and video when missing', async () => {
    const local = useLocalStore();
    const engine = {
      createLocalTracks: vi.fn().mockResolvedValue([
        { getType: () => 'audio' },
        { getType: () => 'video', videoType: 'camera' },
      ]),
    };
    const tracks = await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).toHaveBeenCalledWith(['audio', 'video']);
    expect(tracks).toHaveLength(2);
    expect(local.audio).toBeDefined();
    expect(local.video).toBeDefined();
  });

  it('requests only video when audio already exists', async () => {
    const local = useLocalStore();
    local.audio = { getType: () => 'audio' } as never;
    const engine = {
      createLocalTracks: vi.fn().mockResolvedValue([{ getType: () => 'video', videoType: 'camera' }]),
    };
    await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).toHaveBeenCalledWith(['video']);
  });

  it('skips video when camera is turned off', async () => {
    const local = useLocalStore();
    local.cameraOff = true;
    const engine = {
      createLocalTracks: vi.fn().mockResolvedValue([{ getType: () => 'audio' }]),
    };
    await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).toHaveBeenCalledWith(['audio']);
    expect(local.video).toBeUndefined();
  });

  it('returns early when no devices need to be requested', async () => {
    const local = useLocalStore();
    local.audio = { getType: () => 'audio' } as never;
    local.cameraOff = true;
    const engine = { createLocalTracks: vi.fn() };
    const tracks = await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).not.toHaveBeenCalled();
    expect(tracks).toHaveLength(1);
  });

  it('mutes new audio when the user prefers mute', async () => {
    const local = useLocalStore();
    local.mute = true;
    const audio = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn().mockResolvedValue(undefined),
    };
    const engine = {
      createLocalTracks: vi.fn().mockResolvedValue([audio]),
    };
    await ensureLocalTracks(local, engine as never);
    expect(audio.mute).toHaveBeenCalled();
  });

  it('ignores mute failures on freshly created audio', async () => {
    const local = useLocalStore();
    local.mute = true;
    const audio = {
      getType: () => 'audio',
      isMuted: vi.fn().mockReturnValue(false),
      mute: vi.fn().mockRejectedValue(new Error('fail')),
    };
    const engine = {
      createLocalTracks: vi.fn().mockResolvedValue([audio]),
    };
    await expect(ensureLocalTracks(local, engine as never)).resolves.toBeDefined();
  });

  it('skips create when tracks already exist', async () => {
    const local = useLocalStore();
    local.audio = { getType: () => 'audio' } as never;
    local.video = { getType: () => 'video' } as never;
    local.cameraOff = false;
    const engine = { createLocalTracks: vi.fn() };
    await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).not.toHaveBeenCalled();
  });
});
