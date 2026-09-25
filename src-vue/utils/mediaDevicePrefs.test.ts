import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MEDIA_DEVICE_PREFS_KEY,
  createTrackDeviceOpts,
  loadMediaDevicePrefs,
  saveMediaDevicePrefs,
} from './mediaDevicePrefs';

describe('mediaDevicePrefs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(MEDIA_DEVICE_PREFS_KEY);
  });

  it('returns empty prefs when nothing is stored', () => {
    expect(loadMediaDevicePrefs()).toEqual({});
  });

  it('saves and reloads device ids', () => {
    expect(saveMediaDevicePrefs({ audioinput: 'mic-1', videoinput: 'cam-1' })).toEqual({
      audioinput: 'mic-1',
      videoinput: 'cam-1',
    });
    expect(loadMediaDevicePrefs()).toEqual({
      audioinput: 'mic-1',
      videoinput: 'cam-1',
    });
  });

  it('drops empty ids and ignores invalid JSON', () => {
    saveMediaDevicePrefs({ audioinput: 'mic-1', videoinput: 'cam-1' });
    saveMediaDevicePrefs({ audioinput: '', videoinput: 'cam-2' });
    expect(loadMediaDevicePrefs().audioinput).toBeUndefined();
    expect(loadMediaDevicePrefs().videoinput).toBe('cam-2');
    localStorage.setItem(MEDIA_DEVICE_PREFS_KEY, '{not json');
    expect(loadMediaDevicePrefs()).toEqual({});
    localStorage.setItem(MEDIA_DEVICE_PREFS_KEY, 'null');
    expect(loadMediaDevicePrefs()).toEqual({});
    localStorage.setItem(MEDIA_DEVICE_PREFS_KEY, JSON.stringify({ audioinput: 1, videoinput: 'ok' }));
    expect(loadMediaDevicePrefs()).toEqual({ videoinput: 'ok' });
  });

  it('survives localStorage failures', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(loadMediaDevicePrefs()).toEqual({});
    expect(saveMediaDevicePrefs({ audiooutput: 'spk' })).toEqual({ audiooutput: 'spk' });
  });

  it('builds createLocalTracks opts only when prefs match requested devices', () => {
    expect(createTrackDeviceOpts(['audio'], {})).toBeUndefined();
    expect(createTrackDeviceOpts(['audio'], { audioinput: 'm' })).toEqual({ audioDeviceId: 'm' });
    expect(createTrackDeviceOpts(['video'], { audioinput: 'm', videoinput: 'c' })).toEqual({
      videoDeviceId: 'c',
    });
    expect(createTrackDeviceOpts(['desktop'], { audioinput: 'm', videoinput: 'c' })).toBeUndefined();
  });
});
