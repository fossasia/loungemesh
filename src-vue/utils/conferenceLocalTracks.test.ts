import { describe, expect, it, vi } from 'vitest';
import { getConferenceLocalTracks, publishLocalTrackToConference } from './conferenceLocalTracks';
import type { JitsiTrack } from '@/types/jitsi';

function track(type: 'audio' | 'video', id: string): JitsiTrack {
  return {
    getType: () => type,
    getParticipantId: () => 'local',
    isLocal: () => true,
    isMuted: () => false,
    mute: vi.fn(),
    unmute: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    _id: id,
  } as JitsiTrack & { _id: string };
}

describe('getConferenceLocalTracks', () => {
  it('returns the conference local tracks', () => {
    const audio = track('audio', 'a1');
    expect(getConferenceLocalTracks({ getLocalTracks: () => [audio] } as never)).toEqual([audio]);
  });

  it('returns an empty array when getLocalTracks is unavailable', () => {
    expect(getConferenceLocalTracks({} as never)).toEqual([]);
  });
});

describe('publishLocalTrackToConference', () => {
  it('skips when the track is already on the conference', async () => {
    const audio = track('audio', 'a1');
    const conf = { getLocalTracks: () => [audio] };
    const add = vi.fn();
    const replace = vi.fn();
    expect(
      await publishLocalTrackToConference(conf as never, audio, add, replace),
    ).toBe('skipped');
    expect(add).not.toHaveBeenCalled();
  });

  it('replaces an existing track of the same kind', async () => {
    const oldAudio = track('audio', 'old');
    const newAudio = track('audio', 'new');
    const conf = { getLocalTracks: () => [oldAudio] };
    const replace = vi.fn().mockResolvedValue(undefined);
    expect(
      await publishLocalTrackToConference(
        conf as never,
        newAudio,
        vi.fn(),
        replace,
      ),
    ).toBe('replaced');
    expect(replace).toHaveBeenCalledWith(oldAudio, newAudio);
  });

  it('adds when no track of that kind exists', async () => {
    const video = track('video', 'v1');
    const conf = { getLocalTracks: () => [] };
    const add = vi.fn().mockResolvedValue(undefined);
    expect(
      await publishLocalTrackToConference(conf as never, video, add, vi.fn()),
    ).toBe('added');
    expect(add).toHaveBeenCalledWith(video);
  });
});
