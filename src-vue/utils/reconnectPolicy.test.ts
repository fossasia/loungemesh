import { describe, it, expect } from 'vitest';
import {
  RECONNECT_DELAYS_MS,
  MAX_RECONNECT_ATTEMPTS,
  getDelayForAttempt,
  formatSecondsCountdown,
} from './reconnectPolicy';

describe('reconnectPolicy', () => {
  it('defines the required intervals: 5s, 15s, 30s, 60s, 120s', () => {
    expect(RECONNECT_DELAYS_MS).toEqual([5000, 15000, 30000, 60000, 120000]);
    expect(MAX_RECONNECT_ATTEMPTS).toBe(5);
  });

  it('returns appropriate delay for attempts 1 through 5', () => {
    expect(getDelayForAttempt(1)).toBe(5000);
    expect(getDelayForAttempt(2)).toBe(15000);
    expect(getDelayForAttempt(3)).toBe(30000);
    expect(getDelayForAttempt(4)).toBe(60000);
    expect(getDelayForAttempt(5)).toBe(120000);
  });

  it('returns null for out-of-range attempt numbers', () => {
    expect(getDelayForAttempt(0)).toBeNull();
    expect(getDelayForAttempt(-1)).toBeNull();
    expect(getDelayForAttempt(6)).toBeNull();
    expect(getDelayForAttempt(10)).toBeNull();
  });

  it('formats countdown seconds correctly', () => {
    expect(formatSecondsCountdown(5)).toBe('5s');
    expect(formatSecondsCountdown(15)).toBe('15s');
    expect(formatSecondsCountdown(60)).toBe('1m');
    expect(formatSecondsCountdown(90)).toBe('1m 30s');
    expect(formatSecondsCountdown(120)).toBe('2m');
    expect(formatSecondsCountdown(0)).toBe('0s');
    expect(formatSecondsCountdown(-10)).toBe('0s');
  });
});
