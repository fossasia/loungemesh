import type { MediaService } from '@/services/MediaService';
import { shouldSkipConferenceJoin } from '@/composables/joinConferenceRoom';

export type SessionConferenceState = {
  error?: string;
  isJoining: boolean;
  isJoined: boolean;
  conferenceName: string;
  conferenceObject: unknown;
  displayName: string;
  setConferenceName: (name: string) => void;
  leaveConference: () => void;
};

export type SessionConnectionDeps = {
  connect: () => Promise<void>;
  joinRoom: (room: string, displayName: string, conferenceOptions: Record<string, unknown>) => Promise<void>;
  leaveRoom: () => void;
  conferenceStore: SessionConferenceState;
  engine: MediaService;
  conferenceOptions: Record<string, unknown>;
};

/** Handle route / connection changes for the session Jitsi lifecycle. */
export async function handleSessionConnectionWatch(
  roomId: string,
  isConnected: boolean,
  deps: SessionConnectionDeps,
): Promise<void> {
  if (!roomId) return;

  if (!isConnected) {
    deps.conferenceStore.error = undefined;
    try {
      await deps.connect();
    } catch (e: unknown) {
      deps.conferenceStore.error = e instanceof Error ? e.message : String(e);
    }
    return;
  }

  if (shouldSkipConferenceJoin(deps.conferenceStore)) return;
  if (deps.conferenceStore.isJoined && deps.conferenceStore.conferenceName !== roomId) {
    deps.leaveRoom();
    deps.conferenceStore.leaveConference();
  }
  if (deps.conferenceStore.isJoined) return;
  if (deps.conferenceStore.conferenceObject) return;

  deps.conferenceStore.error = undefined;
  deps.conferenceStore.setConferenceName(roomId);
  try {
    await deps.joinRoom(roomId, deps.conferenceStore.displayName, deps.conferenceOptions);
    deps.conferenceStore.conferenceObject = deps.engine.getConference();
  } catch (e: unknown) {
    deps.conferenceStore.error = e instanceof Error ? e.message : String(e);
    deps.conferenceStore.isJoining = false;
  }
}
