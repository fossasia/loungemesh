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
});
