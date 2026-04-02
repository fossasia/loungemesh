import { describe, expect, it } from 'vitest';
import { getMediaEngineInstance, resetMediaEngineInstance } from './mediaEngineSingleton';
import { JitsiAdapter } from './JitsiAdapter';
import { installJitsiMock } from '@/test/jitsiMock';

describe('mediaEngineSingleton', () => {
  it('returns the same instance until reset', () => {
    const mock = installJitsiMock();
    const a = getMediaEngineInstance();
    const b = getMediaEngineInstance();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(JitsiAdapter);
    resetMediaEngineInstance();
    const c = getMediaEngineInstance();
    expect(c).not.toBe(a);
    mock.cleanup();
  });
});
