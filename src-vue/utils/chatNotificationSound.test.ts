import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isChatNotificationSoundEnabled,
  setChatNotificationSoundEnabled,
} from './chatNotificationSound';

const STORAGE_KEY = 'loungemesh:chat-notification-sound';

describe('chatNotificationSound', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('is enabled by default', () => {
    expect(isChatNotificationSoundEnabled()).toBe(true);
  });

  it('persists disabled state', () => {
    setChatNotificationSoundEnabled(false);
    expect(isChatNotificationSoundEnabled()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0');
  });

  it('persists re-enabled state', () => {
    setChatNotificationSoundEnabled(false);
    setChatNotificationSoundEnabled(true);
    expect(isChatNotificationSoundEnabled()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('no-ops when window is unavailable', () => {
    const original = globalThis.window;
    vi.stubGlobal('window', undefined);
    expect(isChatNotificationSoundEnabled()).toBe(true);
    setChatNotificationSoundEnabled(false);
    vi.stubGlobal('window', original);
  });
});
