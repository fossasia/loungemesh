import { vi } from 'vitest';
import type { JitsiTrack } from '@/types/jitsi';

/** Minimal Jitsi track stub for component and store tests. */
export function makeTrack(
  type: 'audio' | 'video' | 'desktop' = 'video',
  participantId = 'u1',
): JitsiTrack {
  return {
    getType: () => (type === 'audio' ? 'audio' : 'video'),
    videoType: type === 'desktop' ? 'desktop' : 'camera',
    attach: vi.fn(),
    detach: vi.fn(),
    isMuted: () => false,
    mute: vi.fn(),
    unmute: vi.fn(),
    dispose: vi.fn(),
    getParticipantId: () => participantId,
    getOriginalStream: () =>
      ({
        getAudioTracks: () => [],
        getVideoTracks: () => [],
      }) as unknown as MediaStream,
    isLocal: () => false,
  } as unknown as JitsiTrack;
}
