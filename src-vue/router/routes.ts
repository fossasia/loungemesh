import type { RouteRecordRaw } from 'vue-router';

import { conferenceNameDefault } from '@/config/jitsiOptions';
import HomePage from '@/pages/HomePage.vue';
import EnterPage from '@/pages/EnterPage.vue';
import SessionPage from '@/pages/SessionPage.vue';

/** Avoid “No match for /session/” when links omit the room slug. */
const defaultRoomRedirect = () =>
  ({ name: 'session' as const, params: { id: conferenceNameDefault } });

const defaultEnterRedirect = () =>
  ({ name: 'enter' as const, params: { id: conferenceNameDefault } });

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/enter', redirect: defaultEnterRedirect },
  { path: '/enter/', redirect: defaultEnterRedirect },
  { path: '/enter/:id', name: 'enter', component: EnterPage, props: true },
  { path: '/session', redirect: defaultRoomRedirect },
  { path: '/session/', redirect: defaultRoomRedirect },
  { path: '/session/:id', name: 'session', component: SessionPage, props: true },
];

