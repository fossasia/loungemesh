import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isMediaDebugEnabled,
  mediaDebug,
  mediaDebugTrack,
  mediaDebugVideoElement,
} from './mediaDebug';

describe('mediaDebug', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MEDIA_DEBUG', '');
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('is off by default', () => {
    expect(isMediaDebugEnabled()).toBe(false);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mediaDebug('test', 'hello');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it('logs when VITE_MEDIA_DEBUG is true', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mediaDebug('scope', 'msg', { x: 1 });
    expect(info).toHaveBeenCalledWith('[flowspace:media]', 'scope', 'msg', { x: 1 });
    info.mockRestore();
  });

  it('logs when localStorage flag is set', () => {
    localStorage.setItem('flowspace:media-debug', '1');
    expect(isMediaDebugEnabled()).toBe(true);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mediaDebugTrack('wiring', 'trackAdded', {
      getType: () => 'video',
      getParticipantId: () => 'u1',
      isMuted: () => false,
    });
    expect(info).toHaveBeenCalled();
    const detail = info.mock.calls[0][3] as Record<string, unknown>;
    expect(detail.type).toBe('video');
    expect(detail.participantId).toBe('u1');
    info.mockRestore();
  });

  it('mediaDebugVideoElement includes element stats', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const el = document.createElement('video');
    mediaDebugVideoElement('RemoteVideo', 'attach', 'u1', el, { step: 'after' });
    expect(info).toHaveBeenCalled();
    const detail = info.mock.calls[0][3] as Record<string, unknown>;
    expect(detail.participantId).toBe('u1');
    expect(detail.step).toBe('after');
    info.mockRestore();
  });
});
