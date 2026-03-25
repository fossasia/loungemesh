import type { RouteRecordRaw } from 'vue-router';
import { conferenceNameDefault } from '@/config/jitsiOptions';

const defaultRoomRedirect = () =>
  ({ name: 'session' as const, params: { id: conferenceNameDefault } });

const defaultEnterRedirect = () =>
  ({ name: 'enter' as const, params: { id: conferenceNameDefault } });

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/HomePage.vue'),
  },
  { path: '/enter', redirect: defaultEnterRedirect },
  { path: '/enter/', redirect: defaultEnterRedirect },
  {
    path: '/enter/:id',
    name: 'enter',
    component: () => import('@/pages/EnterPage.vue'),
    props: true,
  },
  { path: '/session', redirect: defaultRoomRedirect },
  { path: '/session/', redirect: defaultRoomRedirect },
  {
    path: '/session/:id',
    name: 'session',
    component: () => import('@/pages/SessionPage.vue'),
    props: true,
  },
];
