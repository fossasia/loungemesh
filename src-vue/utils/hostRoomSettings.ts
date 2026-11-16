import type { MediaService } from '@/services/MediaService';
import type { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { buildRoomBackgroundCommands } from '@/utils/roomBackgroundSync';

type SessionFeatures = ReturnType<typeof useSessionFeaturesStore>;

export function broadcastHostRoomSettings(
  engine: MediaService,
  features: SessionFeatures,
  { announceClear = false }: { announceClear?: boolean } = {},
): void {
  if (!features.isHost && !features.isModerator) return;
  if (!features.gridBackgroundUrl && !announceClear) return;
  const email = features.controlEmail();
  const commands = buildRoomBackgroundCommands(features.gridBackgroundUrl, {
    chunkDirect: features.roomBgPersisted === false,
  });
  for (const command of commands) {
    engine.sendCommand(
      'room',
      JSON.stringify(email ? { ...command, email } : command),
    );
  }
}
