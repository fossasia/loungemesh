import { isOnStage } from '@/components/stage/isOnStage';

type ConferenceUser = {
  properties?: { onStage?: unknown };
};

/** Authoritative stage occupant from store, with onStage property fallback. */
export function getStageOccupantId(
  stageOccupantId: string,
  users: Record<string, ConferenceUser>,
): string {
  if (stageOccupantId) return stageOccupantId;
  for (const [id, user] of Object.entries(users)) {
    if (isOnStage(user.properties?.onStage)) return id;
  }
  return '';
}

export function isParticipantOnStage(
  userId: string,
  stageOccupantId: string,
  users: Record<string, ConferenceUser>,
): boolean {
  if (!userId) return false;
  return getStageOccupantId(stageOccupantId, users) === userId;
}
