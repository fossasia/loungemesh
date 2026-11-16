/**
 * Reconnect backoff policy:
 * Intervals: 5s, 15s, 30s, 60s (1 min), 120s (2 min).
 * Total auto-retry attempts: 5.
 */

export const RECONNECT_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000] as const;

export const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;

export type ReconnectPhase = 'online' | 'waiting' | 'attempting' | 'exhausted' | 'recovered';

/**
 * Returns the delay in milliseconds for a 1-indexed attempt number.
 * Returns null if the attempt number exceeds MAX_RECONNECT_ATTEMPTS.
 */
export function getDelayForAttempt(attempt: number): number | null {
  if (attempt < 1 || attempt > MAX_RECONNECT_ATTEMPTS) {
    return null;
  }
  return RECONNECT_DELAYS_MS[attempt - 1];
}

/**
 * Formats a duration in seconds into a user-friendly string (e.g. "5s", "1m 30s", "2m").
 */
export function formatSecondsCountdown(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}
