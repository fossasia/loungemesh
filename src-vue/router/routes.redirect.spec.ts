import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { conferenceNameDefault } from '@/config/jitsiOptions';
import { routes } from '@/router/routes';

describe('router bare paths', () => {
  it('redirects /session and /session/ to default room', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/session/');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('session');
    expect(router.currentRoute.value.params.id).toBe(conferenceNameDefault);

    await router.push('/session');
    expect(router.currentRoute.value.params.id).toBe(conferenceNameDefault);
  });

  it('redirects /enter and /enter/ to default lobby slug', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/enter');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('enter');
    expect(router.currentRoute.value.params.id).toBe(conferenceNameDefault);
  });

  it('redirects /join and /join/ to default join route', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/join/');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('join');
    expect(router.currentRoute.value.params.id).toBe(conferenceNameDefault);
  });
});
