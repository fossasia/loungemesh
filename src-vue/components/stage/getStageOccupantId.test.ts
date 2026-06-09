import { describe, expect, it } from 'vitest';
import { getStageOccupantId, isParticipantOnStage } from './getStageOccupantId';

describe('getStageOccupantId', () => {
  it('prefers the authoritative store id', () => {
    expect(
      getStageOccupantId('store-id', {
        fallback: { properties: { onStage: true } },
      }),
    ).toBe('store-id');
  });

  it('falls back to the first onStage participant', () => {
    expect(
      getStageOccupantId('', {
        off: { properties: { onStage: false } },
        on: { properties: { onStage: 'true' } },
      }),
    ).toBe('on');
  });

  it('returns empty when no occupant exists', () => {
    expect(getStageOccupantId('', { off: { properties: { onStage: false } } })).toBe('');
  });

  it('detects whether a participant is the stage occupant', () => {
    const users = {
      off: { properties: { onStage: false } },
      on: { properties: { onStage: 'true' } },
    };
    expect(isParticipantOnStage('on', '', users)).toBe(true);
    expect(isParticipantOnStage('off', '', users)).toBe(false);
    expect(isParticipantOnStage('on', 'store-id', users)).toBe(false);
    expect(isParticipantOnStage('store-id', 'store-id', users)).toBe(true);
  });
});
