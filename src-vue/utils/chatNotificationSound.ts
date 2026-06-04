const STORAGE_KEY = 'loungemesh:chat-notification-sound';

/** Whether incoming chat messages play a sound while the panel is closed (default on). */
export function isChatNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== '0';
}

export function setChatNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}
