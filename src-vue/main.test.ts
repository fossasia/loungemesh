import { describe, expect, it, vi } from 'vitest';

vi.mock('./router/routes', () => ({
  routes: [
    { path: '/', name: 'home', component: { template: '<div>home</div>' } },
    { path: '/enter/:id?', name: 'enter', component: { template: '<div>enter</div>' } },
    { path: '/session/:id', name: 'session', component: { template: '<div>session</div>' } },
  ],
}));

describe('bootstrap', () => {
  it('mounts the Vue app', async () => {
    const { bootstrap } = await import('./main');
    document.body.innerHTML = '<div id="app"></div>';
    const { app, router } = bootstrap('#app');
    expect(app).toBeTruthy();
    expect(router).toBeTruthy();
    await router.isReady();
    app.unmount();
  });

  it('auto-bootstraps when #app exists on module load', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    const { bootstrap } = await import('./main');
    const { app, router } = bootstrap('#app');
    await router.isReady();
    expect(document.querySelector('#app')?.innerHTML.length).toBeGreaterThan(0);
    app.unmount();
  });

  it('stops local media when navigating from session to home', async () => {
    vi.resetModules();
    const { bootstrap } = await import('./main');
    const { useLocalStore } = await import('@/stores/localStore');
    document.body.innerHTML = '<div id="app"></div>';
    const { app, router } = bootstrap('#app');
    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    await router.push({ name: 'session', params: { id: 'room' } });
    await router.push({ name: 'home' });
    expect(stopSpy).toHaveBeenCalled();
    app.unmount();
  });
});
