import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { joinFromEnterPage } from './enterPageJoin';

describe('joinFromEnterPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('navigates to the session after ensuring tracks', async () => {
    const conference = useConferenceStore();
    conference.setConferenceName('room-a');
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/session/:id', name: 's', component: { template: '<div />' } }],
    });
    const ensure = vi.fn().mockResolvedValue(undefined);
    const push = vi.spyOn(router, 'push');
    await joinFromEnterPage(local, engine, conference, router, ensure);
    expect(ensure).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/session/room-a');
  });

  it('still navigates when track setup fails', async () => {
    const conference = useConferenceStore();
    conference.setConferenceName('room-b');
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/session/:id', name: 's', component: { template: '<div />' } }],
    });
    const push = vi.spyOn(router, 'push');
    await joinFromEnterPage(
      local,
      engine,
      conference,
      router,
      vi.fn().mockRejectedValue(new Error('denied')),
    );
    expect(push).toHaveBeenCalledWith('/session/room-b');
  });
});
