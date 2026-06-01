import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConnectionStore } from './connectionStore';

describe('connectionStore', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', '');
    vi.stubEnv('VITE_SERVICE_URL', '');
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('initializes with default server URL', () => {
    const store = useConnectionStore();
    expect(store.connected).toBe(false);
    expect(store.serverUrl).toBe('meet.jit.si');
  });

  it('strips protocol from VITE_JITSI_PUBLIC_URL', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', 'https://jitsi.example.com');
    vi.stubEnv('VITE_SERVICE_URL', '');
    setActivePinia(createPinia());
    expect(useConnectionStore().serverUrl).toBe('jitsi.example.com');
  });

  it('falls back to VITE_SERVICE_URL when Jitsi public URL is unset', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', '');
    vi.stubEnv('VITE_SERVICE_URL', 'video.example.com');
    setActivePinia(createPinia());
    expect(useConnectionStore().serverUrl).toBe('video.example.com');
  });
});
