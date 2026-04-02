import { describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

describe('throttle', () => {
  it('invokes immediately on first call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 200);
    t('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
    vi.useRealTimers();
  });

  it('batches rapid calls within the window', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 200);
    t(1);
    t(2);
    t(3);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
    vi.useRealTimers();
  });

  it('runs trailing call after the window elapses', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1);
    vi.setSystemTime(now + 50);
    t(2);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenLastCalledWith(2);
    vi.useRealTimers();
  });

  it('ignores stale trailing timer when args were already flushed', () => {
    vi.useFakeTimers();
    const scheduled: Array<() => void> = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      scheduled.push(cb as () => void);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
    const now = Date.now();
    vi.setSystemTime(now);
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1);
    vi.setSystemTime(now + 40);
    t(2);
    scheduled[0]?.();
    scheduled[0]?.();
    expect(fn).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('ignores duplicate timers while a trailing call is scheduled', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1);
    vi.setSystemTime(now + 30);
    t(2);
    t(3);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(70);
    expect(fn).toHaveBeenLastCalledWith(3);
    vi.useRealTimers();
  });

  it('schedules trailing call when inside the window', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1);
    vi.setSystemTime(now + 40);
    t(2);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenLastCalledWith(2);
    vi.useRealTimers();
  });
});
