import type { MediaService } from '@/services/MediaService';
import type { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { buildRoomBackgroundCommands } from '@/utils/roomBackgroundSync';

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
