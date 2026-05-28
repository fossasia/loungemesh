import { describe, expect, it } from 'vitest';
import { conferenceErrorDetail, shouldShowConferenceError } from './conferenceErrorDetail';

describe('conferenceErrorDetail', () => {
  it('uses xmpp detail when present', () => {
    expect(conferenceErrorDetail({ lastErrorMsg: 'room join failed' })).toBe('room join failed');
  });

  it('returns empty when there is no detail', () => {
    expect(conferenceErrorDetail(undefined)).toBe('');
    expect(conferenceErrorDetail({})).toBe('');
    expect(conferenceErrorDetail({ lastErrorMsg: '   ' })).toBe('');
  });

  it('filters ignorable errors for active sessions', () => {
    expect(shouldShowConferenceError('FS-E003', false)).toBe(true);
    expect(shouldShowConferenceError('conference_error', true)).toBe(false);
    expect(shouldShowConferenceError('FS-E004', true)).toBe(false);
    expect(shouldShowConferenceError('', true)).toBe(false);
    expect(shouldShowConferenceError(undefined, false)).toBe(false);
  });
});
