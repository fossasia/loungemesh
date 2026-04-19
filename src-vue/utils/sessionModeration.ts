import type { useConferenceStore } from '@/stores/conferenceStore';
import type { MediaService } from '@/services/MediaService';

type ConferenceStore = ReturnType<typeof useConferenceStore>;

export function muteParticipant(
  conference: ConferenceStore,
  engine: MediaService,
  id: string,
): void {
  engine.sendCommand('mod', JSON.stringify({ action: 'mute', id }));
  const user = conference.users[id];
  if (user) user.mute = true;
}

export function kickParticipant(
  conference: ConferenceStore,
  engine: MediaService,
  id: string,
): void {
  engine.sendCommand('mod', JSON.stringify({ action: 'kick', id }));
  conference.removeUser(id);
}
