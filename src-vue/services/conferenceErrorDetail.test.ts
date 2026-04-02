import { describe, expect, it } from 'vitest';
import { conferenceErrorDetail } from './conferenceErrorDetail';

describe('conferenceErrorDetail', () => {
  it('uses xmpp detail when present', () => {
    expect(conferenceErrorDetail({ lastErrorMsg: 'room join failed' })).toBe('room join failed');
  });

  it('falls back to a default message', () => {
    expect(conferenceErrorDetail(undefined)).toBe('conference_error');
    expect(conferenceErrorDetail({})).toBe('conference_error');
  });
});
