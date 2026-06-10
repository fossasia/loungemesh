import { markRaw } from 'vue';
import type { MediaService } from '@/services/MediaService';
import { normalizeSessionError } from '@/services/sessionErrorCodes';
import { shouldSkipConferenceJoin } from '@/composables/joinConferenceRoom';

export type SessionConferenceState = {
  error?: string;
  isJoining: boolean;
  isJoined: boolean;
  conferenceName: string;
  conferenceObject?: unknown;
  displayName: string;
  setConferenceName: (name: string) => void;
  leaveConference: () => void;
  clearJoinState: () => void;
};

export type SessionConnectionDeps = {
  connect: () => Promise<void>;
  joinRoom: (room: string, displayName: string, conferenceOptions: Record<string, unknown>) => Promise<void>;
  leaveRoom: () => void;
  conferenceStore: SessionConferenceState;
  engine: MediaService;
  conferenceOptions: Record<string, unknown>;
  resetSessionForJoin?: () => void;
};

function isActiveInRoom(deps: SessionConnectionDeps, roomId: string): boolean {
  return (
    deps.engine.isJoined() &&
    deps.conferenceStore.isJoined &&
    deps.conferenceStore.conferenceName === roomId
  );
}

function clearStaleJoin(deps: SessionConnectionDeps): void {
  if (deps.engine.isJoined()) deps.leaveRoom();
  if (deps.conferenceStore.isJoined || deps.conferenceStore.isJoining) {
    deps.conferenceStore.clearJoinState();
  }
}

/** Handle route / connection changes for the session Jitsi lifecycle. */
export async function handleSessionConnectionWatch(
  roomId: string,
  isConnected: boolean,
  deps: SessionConnectionDeps,
): Promise<void> {
  if (!roomId) return;

  if (!isConnected) {
    clearStaleJoin(deps);
    deps.conferenceStore.error = undefined;
    try {
      await deps.connect();
    } catch (e: unknown) {
      deps.conferenceStore.error = normalizeSessionError(
        e instanceof Error ? e.message : String(e),
        'connection',
      );
    }
    return;
  }

  if (shouldSkipConferenceJoin(deps.conferenceStore)) return;
  if (isActiveInRoom(deps, roomId)) return;

  if (deps.conferenceStore.isJoined && deps.conferenceStore.conferenceName !== roomId) {
    deps.leaveRoom();
    deps.conferenceStore.leaveConference();
  }

  clearStaleJoin(deps);

  deps.conferenceStore.error = undefined;
  deps.conferenceStore.setConferenceName(roomId);
  deps.resetSessionForJoin?.();
  await new Promise((r) => window.setTimeout(r, 800));
  try {
    await deps.joinRoom(roomId, deps.conferenceStore.displayName, deps.conferenceOptions);
    const conf = deps.engine.getConference();
    if (conf) {
      deps.conferenceStore.conferenceObject = markRaw(conf as object);
    }
  } catch (e: unknown) {
    deps.conferenceStore.error = normalizeSessionError(
      e instanceof Error ? e.message : String(e),
      'join',
    );
    deps.conferenceStore.isJoining = false;
  }
}
