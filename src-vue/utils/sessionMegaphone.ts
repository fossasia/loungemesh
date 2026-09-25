import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

export function parseMegaphone(value: unknown): boolean {
  return value === true || value === 'true';
}

function isLocalParticipant(id: string): boolean {
  const local = useLocalStore();
  const engineId = getMediaEngineInstance().getLocalUserId();
  return id === local.id || (!!engineId && id === engineId);
}

/** Sync megaphone state onto the local store and remote participant tiles. */
export function applyParticipantMegaphone(participantId: string, on: boolean): void {
  if (isLocalParticipant(participantId)) {
    useSessionFeaturesStore().megaphone = on;
  }
  const user = useConferenceStore().users[participantId];
  if (user) {
    useConferenceStore().patchUser(participantId, {
      properties: { ...user.properties, megaphone: on },
    });
  }
}
