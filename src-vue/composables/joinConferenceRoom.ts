import { markRaw } from 'vue';

export type JoinConferenceState = {
  isJoining: boolean;
};

/** Skip starting a new join while another join is in flight. */
export function shouldSkipConferenceJoin(state: JoinConferenceState): boolean {
  return state.isJoining;
}

export type ConferenceJoinStore = {
  isJoining: boolean;
  conferenceObject?: unknown;
};

export type ConferenceJoinEngine = {
  joinRoom: (room: string, displayName: string, conferenceOptions: Record<string, unknown>) => Promise<void>;
  getConference: () => unknown;
  isJoined: () => boolean;
};

/** Join a Jitsi room and sync conference state on the store. */
export async function runConferenceJoin(
  engine: ConferenceJoinEngine,
  store: ConferenceJoinStore,
  room: string,
  displayName: string,
  conferenceOptions: Record<string, unknown>,
): Promise<void> {
  store.isJoining = true;
  const existing = engine.getConference();
  if (existing) {
    store.conferenceObject = markRaw(existing as object);
  }
  try {
    await engine.joinRoom(room, displayName, conferenceOptions);
    const conf = engine.getConference();
    if (conf) {
      store.conferenceObject = markRaw(conf as object);
    }
  } catch (e) {
    store.isJoining = false;
    throw e;
  }
}
