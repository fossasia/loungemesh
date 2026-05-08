import { describe, expect, it } from 'vitest';
import {
  displayNameFromParticipant,
  participantIdFromTrack,
  sanitizeParticipantProperties,
} from './jitsiParticipant';

describe('displayNameFromParticipant', () => {
  it('reads _displayName from Jitsi participant shape', () => {
    expect(displayNameFromParticipant({ _displayName: 'Alice' })).toBe('Alice');
  });

  it('returns undefined for missing or blank names', () => {
    expect(displayNameFromParticipant(null)).toBeUndefined();
    expect(displayNameFromParticipant({ _displayName: '  ' })).toBeUndefined();
  });
});

describe('participantIdFromTrack', () => {
  it('reads participant id from track', () => {
    expect(
      participantIdFromTrack({
        getParticipantId: () => 'peer-1',
      } as never),
    ).toBe('peer-1');
  });
});

describe('sanitizeParticipantProperties', () => {
  it('keeps only primitive values', () => {
    expect(
      sanitizeParticipantProperties({
        speaking: true,
        handRaised: 'true',
        onStage: false,
        nested: { bad: true },
      }),
    ).toEqual({
      speaking: true,
      handRaised: 'true',
      onStage: false,
    });
  });
});
