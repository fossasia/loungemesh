import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLocalStore } from '@/stores/localStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import {
  stopLocalScreenshare,
  startLocalScreenshare,
  toggleLocalScreenshare,
} from './localScreenshare';

vi.mock('@/services/mediaEngineSingleton', () => {
  const mockConference = {
    addTrack: vi.fn().mockResolvedValue(undefined),
    removeTrack: vi.fn().mockResolvedValue(undefined),
  };
  const mockEngine = {
    getConference: vi.fn().mockReturnValue(mockConference),
    createLocalTracks: vi.fn().mockResolvedValue([]),
    addLocalTrack: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getMediaEngineInstance: () => mockEngine,
  };
});

vi.mock('@/utils/clearMediaElement', () => ({
  waitForMediaElementDetach: () => Promise.resolve(),
}));

vi.mock('@/utils/releaseLocalMedia', () => ({
  releaseLocalMediaTracks: () => Promise.resolve(),
}));

describe('localScreenshare', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('stopLocalScreenshare does nothing if no screenshare active', async () => {
    const local = useLocalStore();
    local.screenshare = undefined;
    await stopLocalScreenshare();
    expect(local.screenshare).toBeUndefined();
  });

  it('stopLocalScreenshare stops active screenshare', async () => {
    const local = useLocalStore();
    const mockTrack = { getType: () => 'video', videoType: 'desktop' } as any;
    local.screenshare = mockTrack;
    await stopLocalScreenshare();
    expect(local.screenshare).toBeUndefined();
  });

  it('startLocalScreenshare returns early if no conference', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValueOnce(null);
    const local = useLocalStore();
    await startLocalScreenshare(engine);
    expect(local.screenshare).toBeUndefined();
  });

  it('startLocalScreenshare returns early if no desktop track returned', async () => {
    const engine = getMediaEngineInstance();
    // No tracks
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValueOnce([]);
    const local = useLocalStore();
    await startLocalScreenshare(engine);
    expect(local.screenshare).toBeUndefined();

    // Non-desktop track
    const cameraTrack = { getType: () => 'video', videoType: 'camera' } as any;
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValueOnce([cameraTrack]);
    await startLocalScreenshare(engine);
    expect(local.screenshare).toBeUndefined();
  });

  it('startLocalScreenshare adds desktop track and updates store', async () => {
    const engine = getMediaEngineInstance();
    const desktopTrack = { getType: () => 'video', videoType: 'desktop' } as any;
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValueOnce([desktopTrack]);
    const addSpy = vi.spyOn(engine, 'addLocalTrack');
    const local = useLocalStore();
    await startLocalScreenshare(engine);
    expect(addSpy).toHaveBeenCalledWith(desktopTrack);
    expect(local.screenshare).toBe(desktopTrack);
  });

  it('toggleLocalScreenshare toggles screenshare on and off', async () => {
    const engine = getMediaEngineInstance();
    const desktopTrack = { getType: () => 'video', videoType: 'desktop' } as any;
    const local = useLocalStore();

    // 1. Toggle On
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValueOnce([desktopTrack]);
    await toggleLocalScreenshare(engine);
    expect(local.screenshare).toBe(desktopTrack);

    // 2. Toggle Off
    await toggleLocalScreenshare(engine);
    expect(local.screenshare).toBeUndefined();
  });
});
