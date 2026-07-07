import { describe, expect, it } from 'vitest';
import { playbackGainForUser } from './participantPlaybackGain';

describe('playbackGainForUser', () => {
  it('returns zero when muted regardless of proximity', () => {
    expect(playbackGainForUser({ mute: true }, 1)).toBe(0);
    expect(playbackGainForUser({ mute: true }, 0.5)).toBe(0);
  });

  it('passes through proximity when not muted', () => {
    expect(playbackGainForUser({ mute: false }, 0.42)).toBe(0.42);
  });

  it('clamps proximity to 0–1', () => {
    expect(playbackGainForUser({ mute: false }, 1.5)).toBe(1);
    expect(playbackGainForUser({ mute: false }, -0.2)).toBe(0);
  });
});
