import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOrCreateSessionUserKey } from './userKey';

describe('userKey', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.name = '';
  });

  it('creates and returns a new session user key if none exists', () => {
    const key = getOrCreateSessionUserKey();
    expect(key).toMatch(/^uk_/);
    expect(sessionStorage.getItem('loungemesh_user_key')).toBe(key);
    expect(window.name).toMatch(/^tab_/);
  });

  it('returns the existing session user key on reload when window.name matches tab owner', () => {
    sessionStorage.setItem('loungemesh_user_key', 'uk_existing_123');
    sessionStorage.setItem('loungemesh_tab_owner', 'tab_same_123');
    window.name = 'tab_same_123';
    const key = getOrCreateSessionUserKey();
    expect(key).toBe('uk_existing_123');
  });

  it('generates a new user key when window.name differs from tab owner (inherited storage in new tab)', () => {
    sessionStorage.setItem('loungemesh_user_key', 'uk_parent_123');
    sessionStorage.setItem('loungemesh_tab_owner', 'tab_parent_123');
    window.name = ''; // newly opened tab
    const key = getOrCreateSessionUserKey();
    expect(key).not.toBe('uk_parent_123');
    expect(key).toMatch(/^uk_/);
    expect(window.name).toMatch(/^tab_/);
    expect(sessionStorage.getItem('loungemesh_tab_owner')).toBe(window.name);
  });

  it('falls back safely if sessionStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Access denied');
    });
    const key = getOrCreateSessionUserKey();
    expect(key).toMatch(/^uk_/);
    spy.mockRestore();
  });
});
