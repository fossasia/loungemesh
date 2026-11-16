import type { MediaService } from '@/services/MediaService';

/** Mute the meeting while this client is in the lobby, and resume it once they are admitted. */
export function applyLobbyPlayback(engine: MediaService, blocked: boolean): void {
  if (engine.setRemotePlaybackSuppressed) engine.setRemotePlaybackSuppressed(blocked);
  if (!blocked && engine.refreshRemoteAudio) engine.refreshRemoteAudio();
}
