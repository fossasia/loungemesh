import { describe, expect, it } from 'vitest';
import {
  displayNameFromParticipant,
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
