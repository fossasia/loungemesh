import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';

import './styles/global.css';

import App from './App.vue';
import { routes } from './router/routes';

export function bootstrap(mountSelector = '#app') {
  const app = createApp(App);
  app.use(createPinia());

  const router = createRouter({
    history: createWebHistory(),
    routes,
  });
  app.use(router);

  app.mount(mountSelector);
  return { app, router };
}

if (typeof document !== 'undefined' && document.querySelector('#app')) {
  bootstrap();
}

