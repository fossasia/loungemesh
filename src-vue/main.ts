import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';

import './styles/global.css';

import {
  installBenignJitsiConsoleFilter,
  installPreGestureAudioContextShim,
} from '@/utils/jitsiConsole';

import App from './App.vue';
import { routes } from './router/routes';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';

const mediaRoutes = new Set(['session', 'enter']);

export function bootstrap(mountSelector = '#app') {
  installPreGestureAudioContextShim();
  installBenignJitsiConsoleFilter();
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  const auth = useAuthStore(pinia);
  void auth.checkAuth();

  const router = createRouter({
    history: createWebHistory(),
    routes,
  });
  router.beforeEach((to, from) => {
    if (mediaRoutes.has(String(from.name)) && to.name === 'home') {
      useLocalStore(pinia).stopAllLocalMedia();
    }
  });
  app.use(router);

  app.mount(mountSelector);
  return { app, router };
}

if (typeof document !== 'undefined' && document.querySelector('#app')) {
  bootstrap();
}

