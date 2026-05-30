import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { playUiSound } from '@/utils/uiSounds';

export function parseHandRaised(value: unknown): boolean {
  return value === true || value === 'true';
}

function isLocalParticipant(id: string): boolean {
  const local = useLocalStore();
  const engineId = getMediaEngineInstance().getLocalUserId();
  return id === local.id || (!!engineId && id === engineId);
}

/** Sync raised-hand state to a participant tile (optional remote notification). */
export function applyParticipantHandRaised(
  participantId: string,
  raised: boolean,
  options?: { notify?: boolean },
): void {
  const conference = useConferenceStore();
  if (!conference.users[participantId]) conference.addUser(participantId);
  const user = conference.users[participantId]!;
  conference.patchUser(participantId, {
    properties: { ...user.properties, handRaised: raised },
  });
  if (options?.notify && raised && !isLocalParticipant(participantId)) {
    playUiSound('handRaise');
  }
}
