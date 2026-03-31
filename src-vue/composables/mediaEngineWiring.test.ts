import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import type { JitsiTrack } from '@/types/jitsi';
import { getJitsiTestContext } from '@/test/jitsiTestContext';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { wireStoreSync } from './mediaEngineWiring';

describe('wireStoreSync', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('syncs connection, conference, tracks, and position commands', async () => {
    const engine = getMediaEngineInstance();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const jitsi = getJitsiTestContext();
    const ev = jitsi.jsMeet.events;

    wireStoreSync(engine);

    await engine.connect();
    jitsi.connection._fire(ev.connection.CONNECTION_ESTABLISHED);
    await engine.joinRoom('room', 'Alice', {});
    await flushPromises();
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack);

    conference.addUser('existing');
    jitsi.conference._fire(ev.conference.TRACK_ADDED, {
      getParticipantId: () => 'existing',
      getType: () => 'audio',
      isMuted: () => false,
      isLocal: () => false,
    } as JitsiTrack);

    jitsi.conference._handlers.get('cmd:pos')?.({
      value: JSON.stringify({ id: 'existing', x: 3, y: 4 }),
    });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: JSON.stringify({ id: 'missing', y: 1 }) });
    jitsi.conference._handlers.get('cmd:pos')?.({ value: 'bad-json' });

    expect(conference.users.existing.pos).toEqual({ x: 3, y: 4 });

    const before = local.id;
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    jitsi.conference._fire(ev.conference.CONFERENCE_JOINED);
    expect(local.id).toBe(before);
  });
});
