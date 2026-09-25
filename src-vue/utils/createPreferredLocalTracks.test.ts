import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_DEVICE_PREFS_KEY, saveMediaDevicePrefs } from './mediaDevicePrefs';
import { createPreferredLocalTracks } from './createPreferredLocalTracks';

describe('createPreferredLocalTracks', () => {
  afterEach(() => {
    localStorage.removeItem(MEDIA_DEVICE_PREFS_KEY);
  });

  it('omits device opts when no prefs are stored', async () => {
    const engine = { createLocalTracks: vi.fn().mockResolvedValue([]) };
    await createPreferredLocalTracks(engine, ['audio']);
    expect(engine.createLocalTracks).toHaveBeenCalledWith(['audio']);
  });

  it('passes stored device ids for matching kinds', async () => {
    saveMediaDevicePrefs({ audioinput: 'mic-1', videoinput: 'cam-1' });
    const engine = { createLocalTracks: vi.fn().mockResolvedValue([]) };
    await createPreferredLocalTracks(engine, ['audio', 'video']);
    expect(engine.createLocalTracks).toHaveBeenCalledWith(['audio', 'video'], {
      audioDeviceId: 'mic-1',
      videoDeviceId: 'cam-1',
    });
  });
});
