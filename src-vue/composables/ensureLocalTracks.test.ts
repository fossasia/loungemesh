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

  it('requests missing track when only audio exists', async () => {
    const local = useLocalStore();
    local.audio = { getType: () => 'audio' } as never;
    const engine = {
      createLocalTracks: vi.fn().mockResolvedValue([
        { getType: () => 'audio' },
        { getType: () => 'video', videoType: 'camera' },
      ]),
    };
    await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).toHaveBeenCalledWith(['audio', 'video']);
  });

  it('skips create when tracks already exist', async () => {
    const local = useLocalStore();
    local.audio = { getType: () => 'audio' } as never;
    local.video = { getType: () => 'video' } as never;
    const engine = { createLocalTracks: vi.fn() };
    await ensureLocalTracks(local, engine as never);
    expect(engine.createLocalTracks).not.toHaveBeenCalled();
  });
});
