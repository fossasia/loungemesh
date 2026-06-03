import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import { restoreCameraVideo } from './restoreCameraVideo';

describe('restoreCameraVideo', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('returns early without conference', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue(undefined);
    const local = useLocalStore();
    await restoreCameraVideo(engine, local);
  });

  it('defaults to camera when no local video track exists', async () => {
    const engine = getMediaEngineInstance();
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => undefined,
    } as never);
    const local = useLocalStore();
    local.videoType = 'desktop';
    await restoreCameraVideo(engine, local);
    expect(local.videoType).toBe('camera');
  });

  it('syncs video type when track is already camera', async () => {
    const engine = getMediaEngineInstance();
    const camera = makeTrack('video');
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => camera,
    } as never);
    const local = useLocalStore();
    local.videoType = 'desktop';
    await restoreCameraVideo(engine, local);
    expect(local.videoType).toBe('camera');
  });

  it('skips when current track is not desktop', async () => {
    const engine = getMediaEngineInstance();
    const camera = makeTrack('video');
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => camera,
    } as never);
    const local = useLocalStore();
    await restoreCameraVideo(engine, local);
    expect(local.videoType).toBe('camera');
  });

  it('returns when no camera track is created', async () => {
    const engine = getMediaEngineInstance();
    const desktop = makeTrack('desktop');
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => desktop,
    } as never);
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([]);
    const replaceSpy = vi.spyOn(engine, 'replaceLocalTrack');
    const local = useLocalStore();
    await restoreCameraVideo(engine, local);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('replaces desktop with a new camera track', async () => {
    const engine = getMediaEngineInstance();
    const desktop = makeTrack('desktop');
    const camera = makeTrack('video');
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => desktop,
    } as never);
    vi.spyOn(engine, 'createLocalTracks').mockResolvedValue([camera]);
    const replaceSpy = vi.spyOn(engine, 'replaceLocalTrack').mockResolvedValue(undefined);
    const local = useLocalStore();
    local.audio = makeTrack('audio');
    await restoreCameraVideo(engine, local);
    expect(replaceSpy).toHaveBeenCalledWith(desktop, camera);
    expect(local.video?.videoType).toBe('camera');
  });

  it('drops desktop track without restoring camera when camera is off', async () => {
    const engine = getMediaEngineInstance();
    const desktop = makeTrack('desktop');
    desktop.dispose = vi.fn();
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => desktop,
    } as never);
    const local = useLocalStore();
    local.cameraOff = true;
    local.video = desktop;
    await restoreCameraVideo(engine, local);
    expect(desktop.dispose).toHaveBeenCalled();
    expect(local.video).toBeUndefined();
  });

  it('clears video when camera creation fails', async () => {
    const engine = getMediaEngineInstance();
    const desktop = makeTrack('desktop');
    vi.spyOn(engine, 'getConference').mockReturnValue({
      getLocalVideoTrack: () => desktop,
    } as never);
    vi.spyOn(engine, 'createLocalTracks').mockRejectedValue(new Error('denied'));
    const local = useLocalStore();
    local.video = desktop;
    await restoreCameraVideo(engine, local);
    expect(local.video).toBeUndefined();
    expect(local.videoType).toBe('camera');
  });
});
