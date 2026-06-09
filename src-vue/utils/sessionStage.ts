import type { MediaService } from '@/services/MediaService';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import {
  defaultStageLayout,
  useSessionFeaturesStore,
  type StageLayout,
  type StagePipCorner,
} from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { stopLocalScreenshare } from '@/utils/localScreenshare';

export type StageCommand =
  | { action: 'promote'; id: string; by?: string }
  | { action: 'demote'; id: string }
  | { action: 'layout'; layout: Partial<StageLayout> }
  | { action: 'settings'; stagePromotionEnabled?: boolean };

export const STAGE_OCCUPIED_MESSAGE = 'The stage is currently occupied.';

export function isStageModeActive(stageOccupantId: string): boolean {
  return !!stageOccupantId;
}

export function shouldAllowScreenshare(localId: string, stageOccupantId: string): boolean {
  if (!stageOccupantId) return true;
  return localId === stageOccupantId;
}

export function canPromoteToStage(
  isHost: boolean,
  stagePromotionEnabled: boolean,
  stageOccupantId: string,
  targetId: string,
): { ok: true } | { ok: false; message: string } {
  if (!isHost) return { ok: false, message: 'Only the host can promote to stage.' };
  if (!stagePromotionEnabled) return { ok: false, message: 'Stage promotion is disabled.' };
  if (stageOccupantId && stageOccupantId !== targetId) {
    return { ok: false, message: STAGE_OCCUPIED_MESSAGE };
  }
  return { ok: true };
}

export function canDemoteFromStage(isHost: boolean, stageOccupantId: string, targetId: string): boolean {
  return isHost && stageOccupantId === targetId;
}

function sendStageCommand(engine: MediaService, command: StageCommand): void {
  engine.sendCommand('stage', JSON.stringify(command));
}

export async function stopLocalScreenshareIfNeeded(localId: string, stageOccupantId: string): Promise<void> {
  if (!stageOccupantId || localId === stageOccupantId) return;
  await stopLocalScreenshare();
}

function applyLocalOnStage(onStage: boolean): void {
  const local = useLocalStore();
  const engine = getMediaEngineInstance();
  local.setOnStage(onStage);
  engine.setLocalParticipantProperty('onStage', onStage);
}

export function applyStagePromote(id: string): void {
  const features = useSessionFeaturesStore();
  const local = useLocalStore();
  const wasLocalOccupant = local.id === id && features.stageOccupantId === id && local.onStage;
  features.stageOccupantId = id;
  void stopLocalScreenshareIfNeeded(local.id, id);
  if (local.id === id) {
    applyLocalOnStage(true);
    if (!wasLocalOccupant) {
      features.setStageMessage('You are on stage. Everyone can see your presentation.');
    }
  }
}

export function applyStageDemote(id: string): void {
  const features = useSessionFeaturesStore();
  const local = useLocalStore();
  if (features.stageOccupantId === id) {
    features.stageOccupantId = '';
    features.stageLayout = defaultStageLayout();
  }
  if (local.id === id) {
    applyLocalOnStage(false);
  }
}

export function applyStageLayout(layout: Partial<StageLayout>): void {
  const features = useSessionFeaturesStore();
  features.stageLayout = { ...features.stageLayout, ...layout };
}

export function promoteToStage(engine: MediaService, targetId: string): { ok: true } | { ok: false; message: string } {
  const features = useSessionFeaturesStore();
  const local = useLocalStore();
  const check = canPromoteToStage(
    features.isHost,
    features.stagePromotionEnabled,
    features.stageOccupantId,
    targetId,
  );
  if (!check.ok) return check;
  sendStageCommand(engine, { action: 'promote', id: targetId, by: local.id });
  applyStagePromote(targetId);
  return { ok: true };
}

export function demoteFromStage(engine: MediaService, targetId: string): void {
  const features = useSessionFeaturesStore();
  if (!canDemoteFromStage(features.isHost, features.stageOccupantId, targetId)) return;
  sendStageCommand(engine, { action: 'demote', id: targetId });
  applyStageDemote(targetId);
}

export function broadcastStageLayout(engine: MediaService, layout: Partial<StageLayout>): void {
  const features = useSessionFeaturesStore();
  const local = useLocalStore();
  if (local.id !== features.stageOccupantId) return;
  applyStageLayout(layout);
  sendStageCommand(engine, { action: 'layout', layout });
}

export function resetStageLayout(engine: MediaService): void {
  broadcastStageLayout(engine, defaultStageLayout());
}

export function syncStagePromotionEnabled(engine: MediaService, enabled: boolean): void {
  const features = useSessionFeaturesStore();
  if (!features.isHost) return;
  features.stagePromotionEnabled = enabled;
  sendStageCommand(engine, { action: 'settings', stagePromotionEnabled: enabled });
}

export function clearStageIfParticipantLeft(userId: string): void {
  const features = useSessionFeaturesStore();
  if (features.stageOccupantId !== userId) return;
  features.stageOccupantId = '';
  features.stageLayout = defaultStageLayout();
}

export function stageDisplayName(userId: string): string {
  if (!userId) return 'Vacant';
  const conference = useConferenceStore();
  const user = conference.users[userId];
  return user?.user?._displayName ?? 'Friendly Sphere';
}

export type { StagePipCorner };
