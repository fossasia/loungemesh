import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';

import './styles/global.css';

import App from './App.vue';
import { routes } from './router/routes';

const app = createApp(App);
app.use(createPinia());

const router = createRouter({
  history: createWebHistory(),
  routes,
});
app.use(router);

app.mount('#app');

