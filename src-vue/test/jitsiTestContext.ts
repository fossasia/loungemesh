import { getActivePinia } from 'pinia';
import { installJitsiMock, type JitsiMockHandles } from './jitsiMock';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';

let active: JitsiMockHandles | null = null;

/** Install lib-jitsi-meet stub and return handles for firing connection/conference events in tests. */
export function installJitsiTestContext(): JitsiMockHandles {
  active?.cleanup();
  active = installJitsiMock();
  return active;
}

export function getJitsiTestContext(): JitsiMockHandles {
  if (!active) {
    return installJitsiTestContext();
  }
  return active;
}

export function cleanupJitsiTestContext(): void {
  active?.cleanup();
  active = null;
}

/** Connect the real JitsiAdapter to the stub and join a room (requires active Pinia). */
export async function connectAndJoinTestConference(
  room = 'test-room',
  displayName = 'Tester',
  conferenceOptions: Record<string, unknown> = {},
) {
  if (!getActivePinia()) {
    throw new Error('connectAndJoinTestConference requires an active Pinia instance');
  }
  const jitsi = getJitsiTestContext();
  const engine = getMediaEngineInstance();
  await engine.connect();
  jitsi.connection._fire(jitsi.jsMeet.events.connection.CONNECTION_ESTABLISHED);
  await engine.joinRoom(room, displayName, conferenceOptions);
  jitsi.conference._fire(jitsi.jsMeet.events.conference.CONFERENCE_JOINED);
  const conference = useConferenceStore();
  conference.conferenceObject = engine.getConference() as never;
  conference.isJoined = true;
  conference.isJoining = false;
  return { jitsi, engine, conference };
}
