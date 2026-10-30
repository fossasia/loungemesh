import { describe, expect, it, vi } from 'vitest';
import type { MediaService } from '@/services/MediaService';
import { applyLobbyPlayback } from './lobbyPlayback';

describe('applyLobbyPlayback', () => {
  it('suppresses playback and skips refresh while blocked', () => {
    const engine = {
      setRemotePlaybackSuppressed: vi.fn(),
      refreshRemoteAudio: vi.fn(),
    } as unknown as MediaService;
    applyLobbyPlayback(engine, true);
    expect(engine.setRemotePlaybackSuppressed).toHaveBeenCalledWith(true);
    expect(engine.refreshRemoteAudio).not.toHaveBeenCalled();
  });

  it('resumes playback when the lobby lets the person in', () => {
    const engine = {
      setRemotePlaybackSuppressed: vi.fn(),
      refreshRemoteAudio: vi.fn(),
    } as unknown as MediaService;
    applyLobbyPlayback(engine, false);
    expect(engine.setRemotePlaybackSuppressed).toHaveBeenCalledWith(false);
    expect(engine.refreshRemoteAudio).toHaveBeenCalled();
  });

  it('does nothing when the engine has no playback hooks', () => {
    expect(() => applyLobbyPlayback({} as MediaService, false)).not.toThrow();
    expect(() => applyLobbyPlayback({} as MediaService, true)).not.toThrow();
  });
});
