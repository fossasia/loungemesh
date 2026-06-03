import { describe, expect, it, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useInfoStore } from './infoStore';

describe('infoStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('toggles visibility', () => {
    const store = useInfoStore();
    expect(store.show).toBe(true);
    store.setHidden();
    expect(store.show).toBe(false);
    store.setVisible();
    expect(store.show).toBe(true);
    store.toggleVisible();
    expect(store.show).toBe(false);
  });
});
