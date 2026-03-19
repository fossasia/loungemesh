import { defineStore } from 'pinia';
import type { JitsiConnectionLike, JitsiMeetJSLike } from '@/types/jitsi';
import { getConnectionOptions } from '@/config/connectionOptions';

export type ConnectionState = {
  serverUrl: string;
  jsMeet?: JitsiMeetJSLike;
  connection?: JitsiConnectionLike;
  connected: boolean;
  error?: string;
};

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
  actions: {
    async initJitsiMeet(): Promise<JitsiMeetJSLike> {
      if (this.jsMeet) return this.jsMeet;
      const jsMeet = window.JitsiMeetJS;
      if (!jsMeet) {
        throw new Error('window.JitsiMeetJS not found. Load lib-jitsi-meet before app start.');
      }
      jsMeet.setLogLevel(jsMeet.logLevels.ERROR);
      jsMeet.init({});
      this.jsMeet = jsMeet;
      return jsMeet;
    },

    async connectServer(): Promise<void> {
      await this.initJitsiMeet();
      const jsMeet = this.jsMeet!;
      if (this.connection) {
        if (!this.connected) this.connection.connect();
        return;
      }

      const options = getConnectionOptions() as Record<string, unknown>;

      const connection = new jsMeet.JitsiConnection(null, null, options);
      connection.addEventListener(jsMeet.events.connection.CONNECTION_ESTABLISHED, () => {
        this.connected = true;
        this.error = undefined;
      });
      connection.addEventListener(jsMeet.events.connection.CONNECTION_FAILED, () => {
        this.connected = false;
        const detail = connection?.xmpp?.lastErrorMsg;
        this.error =
          detail && String(detail).trim().length
            ? String(detail)
            : 'Connection failed — check Jitsi is up, PUBLIC_URL / VITE_JITSI_PUBLIC_URL, firewall, and UDP 10000.';
        this.connection = undefined;
      });
      connection.addEventListener(jsMeet.events.connection.CONNECTION_DISCONNECTED, () => {
        this.connected = false;
      });

      connection.connect();
      this.connection = connection;
    },

    disconnectServer() {
      this.connection?.disconnect();
      this.connection = undefined;
      this.connected = false;
      this.error = undefined;
    },
  },
});

