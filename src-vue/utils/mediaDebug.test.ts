import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isMediaDebugEnabled,
  mediaDebug,
  mediaDebugBridgeHint,
  mediaDebugHelp,
  mediaDebugTrack,
  mediaDebugVideoAfterAttach,
  mediaDebugVideoElement,
  logMediaStateSnapshot,
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

  it('reports disabled when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(isMediaDebugEnabled()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('mediaDebugVideoElement tolerates a missing element and reads srcObject id', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mediaDebugVideoElement('RemoteVideo', 'attach', 'u1', null);
    const noEl = info.mock.calls[0][3] as Record<string, unknown>;
    expect(noEl.hasElement).toBe(false);
    expect(noEl.srcObjectId).toBeUndefined();

    const el = document.createElement('video');
    Object.defineProperty(el, 'srcObject', { value: { id: 'stream-1' }, configurable: true });
    mediaDebugVideoElement('RemoteVideo', 'attach', 'u2', el);
    const withStream = info.mock.calls[1][3] as Record<string, unknown>;
    expect(withStream.srcObjectId).toBe('stream-1');
    info.mockRestore();
  });

  it('logs a message with no detail object', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mediaDebug('scope', 'plain message');
    expect(info).toHaveBeenCalledWith('[flowspace:media]', 'scope', 'plain message');
    info.mockRestore();
  });

  it('mediaDebugHelp only logs guidance when debug is enabled', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mediaDebugHelp();
    expect(info).not.toHaveBeenCalled();
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    mediaDebugHelp();
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });

  describe('mediaDebugVideoAfterAttach', () => {
    afterEach(() => vi.useRealTimers());

    it('does nothing when disabled or element missing', () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      mediaDebugVideoAfterAttach('scope', 'u1', document.createElement('video'));
      vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
      mediaDebugVideoAfterAttach('scope', 'u1', null);
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    });

    it('snapshots on loadedmetadata, timeout, and logs element errors', () => {
      vi.useFakeTimers();
      vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const el = document.createElement('video');
      mediaDebugVideoAfterAttach('RemoteVideo', 'u1', el);
      el.dispatchEvent(new Event('loadedmetadata'));
      expect(info).toHaveBeenCalled();
      info.mockClear();
      vi.advanceTimersByTime(500);
      expect(info).toHaveBeenCalled();

      const el2 = document.createElement('video');
      mediaDebugVideoAfterAttach('RemoteVideo', 'u2', el2);
      info.mockClear();
      el2.dispatchEvent(new Event('error'));
      expect(info).toHaveBeenCalledWith('[flowspace:media]', 'RemoteVideo', 'video-element-error', {
        participantId: 'u2',
      });
      info.mockRestore();
    });
  });

  describe('mediaDebugBridgeHint', () => {
    it('does nothing when debug is disabled', () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      mediaDebugBridgeHint('https://x/colibri-ws/172.16.0.1/');
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    });

    it('warns about Docker bridge IPs and failed colibri sockets', () => {
      vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      mediaDebugBridgeHint('wss://host/colibri-ws/172.16.0.1/abc');
      expect(info).toHaveBeenCalledWith(
        '[flowspace:media]',
        'diagnosis',
        expect.stringContaining('Docker bridge IP'),
        expect.objectContaining({ colibriUrl: 'wss://host/colibri-ws/172.16.0.1/abc' }),
      );
      info.mockClear();
      mediaDebugBridgeHint('wss://host/colibri-ws/endpoint/1006');
      expect(info).toHaveBeenCalledWith(
        '[flowspace:media]',
        'diagnosis',
        expect.stringContaining('colibri WebSocket failed'),
      );
      info.mockClear();
      mediaDebugBridgeHint();
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    });
  });

  it('logMediaStateSnapshot logs a full state snapshot when enabled', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logMediaStateSnapshot({
      reason: 'test',
      joined: true,
      localId: 'me',
      cameraOff: false,
      hasLocalVideo: true,
      users: [],
      visibleUserIds: [],
      usersOnStage: [],
    });
    expect(info).toHaveBeenCalled();
    const detail = info.mock.calls[0][3] as Record<string, unknown>;
    expect(detail.reason).toBe('test');
    expect(detail).toHaveProperty('openBridgeChannel');
    info.mockRestore();
  });
});
