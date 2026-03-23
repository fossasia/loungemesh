import { defineStore } from 'pinia';
import type { JitsiConnection, JitsiMeetJS } from '@/types/jitsi';

export type ConnectionState = {
  serverUrl: string;
  jsMeet?: JitsiMeetJS;
  connection?: JitsiConnection;
  connected: boolean;
  error?: string;
};

/** UI connection state — Jitsi lifecycle lives in useMediaEngine / JitsiAdapter. */
export const useConnectionStore = defineStore('connection', {
  state: (): ConnectionState => ({
    serverUrl:
      import.meta.env.VITE_JITSI_PUBLIC_URL?.replace(/^https?:\/\//i, '') ||
      import.meta.env.VITE_SERVICE_URL ||
      'meet.jit.si',
    jsMeet: undefined,
    connection: undefined,
    connected: false,
    error: undefined,
  }),
});
