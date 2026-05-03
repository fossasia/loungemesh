import { describe, expect, it, vi } from 'vitest';
import { applyWorkerVolume } from './applyWorkerVolume';

describe('applyWorkerVolume', () => {
  it('updates known users and ignores unknown ids', () => {
    const users: Record<string, { volume: number }> = { known: { volume: 0 } };
    const patchUser = vi.fn();
    const setVolume = vi.fn();
    applyWorkerVolume('known', 0.5, users, patchUser, setVolume);
    applyWorkerVolume('missing', 0.9, users, patchUser, setVolume);
    expect(patchUser).toHaveBeenCalledWith('known', { volume: 0.5 });
    expect(setVolume).toHaveBeenCalledTimes(1);
  });
});
