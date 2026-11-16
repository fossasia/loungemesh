import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useReconnectStore } from './reconnectStore';

describe('reconnectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes in online phase', () => {
    const store = useReconnectStore();
    expect(store.phase).toBe('online');
    expect(store.attempt).toBe(0);
    expect(store.secondsLeft).toBe(0);
    expect(store.isIntentionalLeave).toBe(false);
  });

  it('schedules retry attempt 1 with 5s delay on connection loss', () => {
    const store = useReconnectStore();
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.setRetryAction(mockAction);

    store.onConnectionLost('server_down');

    expect(store.phase).toBe('waiting');
    expect(store.attempt).toBe(1);
    expect(store.secondsLeft).toBe(5);
    expect(store.lastReason).toBe('server_down');

    // Advance 1 second
    vi.advanceTimersByTime(1000);
    expect(store.secondsLeft).toBe(4);

    // Advance 4 more seconds
    vi.advanceTimersByTime(4000);
    expect(store.phase).toBe('attempting');
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('cycles through 5s, 15s, 30s, 60s, 120s delays then exhausts', () => {
    const store = useReconnectStore();
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.setRetryAction(mockAction);

    // Attempt 1 (5s)
    store.onConnectionLost();
    expect(store.attempt).toBe(1);
    expect(store.secondsLeft).toBe(5);
    vi.advanceTimersByTime(5000);
    expect(store.phase).toBe('attempting');

    // Attempt 2 (15s)
    store.phase = 'online';
    store.onConnectionLost();
    expect(store.attempt).toBe(2);
    expect(store.secondsLeft).toBe(15);
    vi.advanceTimersByTime(15000);
    expect(store.phase).toBe('attempting');

    // Attempt 3 (30s)
    store.phase = 'online';
    store.onConnectionLost();
    expect(store.attempt).toBe(3);
    expect(store.secondsLeft).toBe(30);
    vi.advanceTimersByTime(30000);
    expect(store.phase).toBe('attempting');

    // Attempt 4 (60s)
    store.phase = 'online';
    store.onConnectionLost();
    expect(store.attempt).toBe(4);
    expect(store.secondsLeft).toBe(60);
    vi.advanceTimersByTime(60000);
    expect(store.phase).toBe('attempting');

    // Attempt 5 (120s)
    store.phase = 'online';
    store.onConnectionLost();
    expect(store.attempt).toBe(5);
    expect(store.secondsLeft).toBe(120);
    vi.advanceTimersByTime(120000);
    expect(store.phase).toBe('attempting');

    // Attempt 6 -> exhausted
    store.phase = 'online';
    store.onConnectionLost();
    expect(store.phase).toBe('exhausted');
    expect(store.attempt).toBe(5);
    expect(store.secondsLeft).toBe(0);
  });

  it('ignores onConnectionLost when isIntentionalLeave is true', () => {
    const store = useReconnectStore();
    store.setIntentionalLeave(true);
    store.onConnectionLost('test');

    expect(store.phase).toBe('online');
    expect(store.attempt).toBe(0);
  });

  it('clears state when setIntentionalLeave(true) is called while waiting', () => {
    const store = useReconnectStore();
    store.onConnectionLost();
    expect(store.phase).toBe('waiting');

    store.setIntentionalLeave(true);
    expect(store.phase).toBe('online');
    expect(store.attempt).toBe(0);
    expect(store.secondsLeft).toBe(0);
    expect(store.isIntentionalLeave).toBe(true);
  });

  it('ignores duplicate onConnectionLost calls while waiting and advances when attempting fails', () => {
    const store = useReconnectStore();
    store.onConnectionLost('first');
    expect(store.attempt).toBe(1);

    // Duplicate while waiting is ignored
    store.onConnectionLost('second');
    expect(store.attempt).toBe(1);
    expect(store.phase).toBe('waiting');

    // Failure while attempting transitions to next attempt
    store.phase = 'attempting';
    store.onConnectionLost('third');
    expect(store.attempt).toBe(2);
    expect(store.phase).toBe('waiting');
    expect(store.secondsLeft).toBe(15);
  });

  it('handles retryNow() when waiting', () => {
    const store = useReconnectStore();
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.setRetryAction(mockAction);

    store.onConnectionLost();
    expect(store.phase).toBe('waiting');

    store.retryNow();
    expect(store.phase).toBe('attempting');
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('handles retryNow() when exhausted and resets attempt', () => {
    const store = useReconnectStore();
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.setRetryAction(mockAction);

    store.attempt = 5;
    store.phase = 'exhausted';

    store.retryNow();
    expect(store.phase).toBe('attempting');
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('does nothing on retryNow() when already online', () => {
    const store = useReconnectStore();
    const mockAction = vi.fn();
    store.setRetryAction(mockAction);

    store.retryNow();
    expect(mockAction).not.toHaveBeenCalled();
    expect(store.phase).toBe('online');
  });

  it('handles action failure in triggerAttempt and schedules next cycle', async () => {
    const store = useReconnectStore();
    const failingAction = vi.fn().mockRejectedValue(new Error('network error'));
    store.setRetryAction(failingAction);

    store.onConnectionLost('first');
    expect(store.attempt).toBe(1);

    // Let the attempt fire
    await vi.advanceTimersByTimeAsync(5000);
    // Failure should cause onConnectionLost to run, advancing to attempt 2
    expect(store.phase).toBe('waiting');
    expect(store.attempt).toBe(2);
    expect(store.secondsLeft).toBe(15);
  });

  it('transitions to recovered phase and then online on connection recovery', () => {
    const store = useReconnectStore();
    store.onConnectionLost();
    expect(store.phase).toBe('waiting');

    store.onConnectionRecovered();
    expect(store.phase).toBe('recovered');
    expect(store.attempt).toBe(0);

    vi.advanceTimersByTime(2500);
    expect(store.phase).toBe('online');
  });

  it('remains online when onConnectionRecovered is called while already online', () => {
    const store = useReconnectStore();
    expect(store.phase).toBe('online');

    store.onConnectionRecovered();
    expect(store.phase).toBe('online');
  });

  it('resets completely when reset() is called', () => {
    const store = useReconnectStore();
    store.onConnectionLost();
    store.setIntentionalLeave(true);

    store.reset();
    expect(store.phase).toBe('online');
    expect(store.attempt).toBe(0);
    expect(store.secondsLeft).toBe(0);
    expect(store.lastReason).toBe('');
    expect(store.isIntentionalLeave).toBe(false);
  });
});
