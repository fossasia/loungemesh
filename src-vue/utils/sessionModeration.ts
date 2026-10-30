import type { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import type { MediaService } from '@/services/MediaService';

type ConferenceStore = ReturnType<typeof useConferenceStore>;

function withControlEmail<T extends Record<string, unknown>>(payload: T): T & { email?: string } {
  const email = useSessionFeaturesStore().controlEmail();
  return email ? { ...payload, email } : payload;
}

export function muteParticipant(
  conference: ConferenceStore,
  engine: MediaService,
  id: string,
): void {
  engine.sendCommand('mod', JSON.stringify(withControlEmail({ action: 'mute', id })));
  if (conference.users[id]) {
    conference.patchUser(id, { mute: true });
    engine.setParticipantVolume(id, 0);
  }
}

export function disableParticipantCamera(
  conference: ConferenceStore,
  engine: MediaService,
  id: string,
): void {
  engine.sendCommand('mod', JSON.stringify(withControlEmail({ action: 'camera_off', id })));
  if (conference.users[id]) {
    conference.clearUserTrack(id, 'video');
  }
}

export function setParticipantMediaLock(
  conference: ConferenceStore,
  engine: MediaService,
  id: string,
  locks: { mic?: boolean; camera?: boolean },
): void {
  const features = useSessionFeaturesStore();
  features.setMediaLock(id, locks);
  const current = features.mediaLocks[id] ?? {};
  engine.sendCommand(
    'mod',
    JSON.stringify(
      withControlEmail({
        action: 'lock_media',
        id,
        mic: !!current.mic,
        camera: !!current.camera,
      }),
    ),
  );
  if (current.mic && conference.users[id]) {
    conference.patchUser(id, { mute: true });
    engine.setParticipantVolume(id, 0);
  }
  if (current.camera && conference.users[id]) {
    conference.clearUserTrack(id, 'video');
  }
}

export function kickParticipant(
  conference: ConferenceStore,
  engine: MediaService,
  id: string,
): void {
  engine.sendCommand('mod', JSON.stringify(withControlEmail({ action: 'kick', id })));
  conference.removeUser(id);
}
