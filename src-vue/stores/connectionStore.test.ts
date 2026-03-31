import { describe, expect, it, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConnectionStore } from './connectionStore';

describe('connectionStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes with default server URL', () => {
    const store = useConnectionStore();
    expect(store.connected).toBe(false);
    expect(store.serverUrl).toBeTruthy();
  });
});
