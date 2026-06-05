import type { MediaService } from '@/services/MediaService';
import type { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { buildRoomBackgroundCommands } from '@/utils/roomBackgroundSync';

const STORAGE_PREFIX = 'loungemesh:host-room:';

export type PersistedHostRoomSettings = {
  gridBackgroundUrl?: string;
  notesTemplate?: string;
};

export function hostRoomSettingsStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function loadPersistedHostRoomSettings(sessionId: string): PersistedHostRoomSettings | null {
  if (!sessionId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(hostRoomSettingsStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedHostRoomSettings;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      gridBackgroundUrl:
        typeof parsed.gridBackgroundUrl === 'string' ? parsed.gridBackgroundUrl : undefined,
      notesTemplate: typeof parsed.notesTemplate === 'string' ? parsed.notesTemplate : undefined,
    };
  } catch {
    return null;
  }
}

export function persistHostRoomSettings(sessionId: string, settings: PersistedHostRoomSettings): void {
  if (!sessionId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(hostRoomSettingsStorageKey(sessionId), JSON.stringify(settings));
  } catch {
    /* quota or private mode */
  }
}

type SessionFeatures = ReturnType<typeof useSessionFeaturesStore>;

export function broadcastHostRoomSettings(
  engine: MediaService,
  features: SessionFeatures,
  { announceClear = false }: { announceClear?: boolean } = {},
): void {
  if (!features.isHost) return;
  if (!features.gridBackgroundUrl && !announceClear) return;
  for (const command of buildRoomBackgroundCommands(features.gridBackgroundUrl)) {
    engine.sendCommand('room', JSON.stringify(command));
  }
}
