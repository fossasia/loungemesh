import { describe, expect, it } from 'vitest';
import {
  SESSION_ERROR_CODES,
  classifySessionError,
  formatUserFacingError,
  isSessionErrorCode,
  normalizeSessionError,
  shouldShowConferenceError,
  userMessageForCode,
} from './sessionErrorCodes';

describe('sessionErrorCodes', () => {
  it('recognizes stored codes', () => {
    expect(isSessionErrorCode('FS-E001')).toBe(true);
    expect(isSessionErrorCode('connect fail')).toBe(false);
  });

  it('classifies connection failures', () => {
    expect(classifySessionError('Connection failed — check Jitsi', 'connection')).toBe(
      SESSION_ERROR_CODES.CONNECTION_FAILED,
    );
    expect(classifySessionError('xmpp-error', 'connection')).toBe(
      SESSION_ERROR_CODES.CONNECTION_FAILED,
    );
  });

  it('classifies network, auth, join, and conference errors', () => {
    expect(classifySessionError('offline')).toBe(SESSION_ERROR_CODES.NETWORK);
    expect(classifySessionError('not-authorized')).toBe(SESSION_ERROR_CODES.AUTH_FAILED);
    expect(classifySessionError('join failed', 'join')).toBe(SESSION_ERROR_CODES.JOIN_FAILED);
    expect(classifySessionError('focus unavailable', 'conference')).toBe(
      SESSION_ERROR_CODES.SESSION_UNAVAILABLE,
    );
    expect(classifySessionError('Jitsi connection is not ready.')).toBe(
      SESSION_ERROR_CODES.NOT_READY,
    );
    expect(classifySessionError('connection lost')).toBe(SESSION_ERROR_CODES.CONNECTION_LOST);
    expect(classifySessionError('room join failed')).toBe(SESSION_ERROR_CODES.JOIN_FAILED);
    expect(classifySessionError('weird failure')).toBe(SESSION_ERROR_CODES.UNKNOWN);
    expect(classifySessionError('   ')).toBe(SESSION_ERROR_CODES.UNKNOWN);
    expect(classifySessionError('misc', 'conference')).toBe(
      SESSION_ERROR_CODES.SESSION_UNAVAILABLE,
    );
  });

  it('covers every user-facing message', () => {
    expect(userMessageForCode(SESSION_ERROR_CODES.CONNECTION_LOST)).toBe('The connection was lost.');
    expect(userMessageForCode(SESSION_ERROR_CODES.SESSION_UNAVAILABLE)).toContain('unavailable');
    expect(userMessageForCode(SESSION_ERROR_CODES.AUTH_FAILED)).toContain('Sign-in');
    expect(userMessageForCode(SESSION_ERROR_CODES.NOT_READY)).toContain('ready');
    expect(userMessageForCode(SESSION_ERROR_CODES.UNKNOWN)).toBe('Something went wrong.');
  });

  it('formats concise user-facing messages', () => {
    expect(formatUserFacingError('connect fail')).toMatch(/FS-E00[1368]/);
    expect(formatUserFacingError('FS-E003')).toBe("Couldn't join this session. (FS-E003)");
    expect(userMessageForCode(SESSION_ERROR_CODES.NETWORK)).toBe('Check your network connection.');
  });

  it('normalizes raw details to codes', () => {
    expect(normalizeSessionError('room join failed', 'join')).toBe(SESSION_ERROR_CODES.JOIN_FAILED);
    expect(normalizeSessionError('FS-E005')).toBe(SESSION_ERROR_CODES.AUTH_FAILED);
  });

  it('filters ignorable conference errors while joined', () => {
    expect(shouldShowConferenceError('FS-E004', false)).toBe(true);
    expect(shouldShowConferenceError('conference_error', true)).toBe(false);
    expect(shouldShowConferenceError('FS-E003', true)).toBe(true);
    expect(shouldShowConferenceError(undefined, false)).toBe(false);
    expect(shouldShowConferenceError('   ', false)).toBe(false);
  });
});
