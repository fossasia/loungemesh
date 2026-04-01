import { describe, expect, it, vi } from 'vitest';
import { applyWorkerVolume } from './applyWorkerVolume';

describe('applyWorkerVolume', () => {
  it('updates known users and ignores unknown ids', () => {
    const users: Record<string, { volume: number }> = { known: { volume: 0 } };
    const setVolume = vi.fn();
    applyWorkerVolume('known', 0.5, users, setVolume);
    applyWorkerVolume('missing', 0.9, users, setVolume);
    expect(users.known.volume).toBe(0.5);
    expect(setVolume).toHaveBeenCalledTimes(1);
  });
});
