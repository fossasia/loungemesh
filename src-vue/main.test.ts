import { describe, expect, it, vi } from 'vitest';

describe('bootstrap', () => {
  it('mounts the Vue app', async () => {
    const { bootstrap } = await import('./main');
    document.body.innerHTML = '<div id="app"></div>';
    const { app, router } = bootstrap('#app');
    expect(app).toBeTruthy();
    expect(router).toBeTruthy();
  });

  it('auto-bootstraps when #app exists on module load', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    await import('./main');
    expect(document.querySelector('#app')?.innerHTML.length).toBeGreaterThan(0);
  });
});
