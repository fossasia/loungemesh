import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
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

function isHandRaised(participantId: string): boolean {
  if (isLocalParticipant(participantId)) {
    return useSessionFeaturesStore().handRaised;
  }
  return parseHandRaised(useConferenceStore().users[participantId]?.properties?.handRaised);
}

/** Sync raised-hand state to a participant tile (optional remote notification). */
export function applyParticipantHandRaised(
  participantId: string,
  raised: boolean,
  options?: { notify?: boolean },
): void {
  const wasRaised = isHandRaised(participantId);
  if (isLocalParticipant(participantId)) {
    useSessionFeaturesStore().handRaised = raised;
  }
  const user = useConferenceStore().users[participantId];
  if (user) {
    useConferenceStore().patchUser(participantId, {
      properties: { ...user.properties, handRaised: raised },
    });
  }
  if (options?.notify && raised && !wasRaised && !isLocalParticipant(participantId)) {
    playUiSound('handRaise');
  }
}
