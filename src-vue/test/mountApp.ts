import { mount, type MountingOptions } from '@vue/test-utils';
import { createPinia, getActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import type { Component } from 'vue';
import { routes } from '@/router/routes';

export type MountContext = {
  pinia: Pinia;
  router: Router;
};

export function createTestRouter(initialPath = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  return router.push(initialPath).then(() => router);
}

export async function mountWithApp(
  component: Component,
  options: MountingOptions & { route?: string } = {},
): Promise<MountContext & { wrapper: ReturnType<typeof mount> }> {
  const pinia = getActivePinia() ?? createPinia();
  const router = await createTestRouter(options.route ?? '/');
  await router.isReady();
  const wrapper = mount(component, {
    ...options,
    global: {
      plugins: [pinia, router],
      stubs: {
        teleport: true,
        LocalStoreLogic: true,
        JitsiConnection: true,
        ...(options.global?.stubs ?? {}),
      },
      ...options.global,
    },
  });
  return { wrapper, pinia, router };
}
