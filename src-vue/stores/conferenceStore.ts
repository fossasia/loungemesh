import { defineStore } from 'pinia';
import type { JitsiConferenceLike, JitsiTrackLike } from '@/types/jitsi';
import { conferenceNameDefault, conferenceOptions } from '@/config/jitsiOptions';
import { secureConferenceName } from '@/utils/secureConferenceName';
import { useConnectionStore } from './connectionStore';
import { useLocalStore } from './localStore';

export type Vector2 = { x: number; y: number };

export type RemoteUser = {
  id: string;
  mute: boolean;
  volume: number;
  pos: Vector2;
  audio?: JitsiTrackLike;
  video?: JitsiTrackLike;
  videoType?: 'camera' | 'desktop';
  properties: Record<string, unknown>;
  user?: any;
};

export type ConferenceState = {
  conferenceObject?: JitsiConferenceLike;
  conferenceName: string;
  isJoined: boolean;
  isJoining: boolean;
  users: Record<string, RemoteUser>;
  displayName: string;
  error?: string;
  messages: Array<{ id: string; text: string; nr: number }>;
};

export const useConferenceStore = defineStore('conference', {
  state: (): ConferenceState => ({
    conferenceObject: undefined,
    conferenceName: conferenceNameDefault,
    isJoined: false,
    isJoining: false,
    users: {},
    displayName: 'Friendly Sphere',
    error: undefined,
    messages: [],
  }),
  actions: {
    setConferenceName(name: string) {
      this.conferenceName = name;
    },
    addUser(id: string, user?: any) {
      this.users[id] = {
        id,
        mute: false,
        volume: 1,
        pos: { x: 0, y: 0 },
        properties: {},
        ...((user && { user }) as any),
      };
    },
    removeUser(id: string) {
      delete this.users[id];
    },
    setDisplayName(name: string) {
      this.displayName = name;
      this.conferenceObject?.setDisplayName?.(name);
    },
    updateUserPosition(id: string, pos: Vector2) {
      if (!this.users[id]) return;
      this.users[id].pos = pos;
    },

    async initConference(conferenceId: string) {
      if (this.isJoining || this.conferenceObject) return;
      this.isJoining = true;
      const connectionStore = useConnectionStore();

      const entered =
        (conferenceId?.length ? conferenceId : '') || this.conferenceName || conferenceNameDefault;
      this.conferenceName = entered;

      const jsMeet = connectionStore.jsMeet;
      const connection = connectionStore.connection;
      if (!jsMeet || !connection) {
        throw new Error('Jitsi connection is not ready. Wait for the session to connect or check server settings.');
      }

      const name = secureConferenceName(entered, import.meta.env.VITE_SESSION_PREFIX);

      const conference = connection.initJitsiConference(name, conferenceOptions);

      conference.on(jsMeet.events.conference.USER_JOINED, (id: string, user: any) => this.addUser(id, user));
      conference.on(jsMeet.events.conference.USER_LEFT, (id: string) => this.removeUser(id));
      conference.on(jsMeet.events.conference.CONFERENCE_JOINED, () => {
        this.isJoined = true;
        this.isJoining = false;
        conference.setDisplayName?.(this.displayName);
      });
      conference.on(jsMeet.events.conference.MESSAGE_RECEIVED, (id: string, text: string, nr: number) => {
        this.messages = [...this.messages, { id, text, nr }];
      });
      conference.on(jsMeet.events.conference.CONFERENCE_ERROR, () => {
        this.error = connection?.xmpp?.lastErrorMsg ?? 'conference_error';
        this.conferenceObject = undefined;
        this.isJoined = false;
        this.isJoining = false;
      });

      conference.on(jsMeet.events.conference.TRACK_ADDED, (track: any) => {
        if (track.isLocal?.()) return;
        const id = track.getParticipantId?.();
        if (!id) return;
        if (!this.users[id]) this.addUser(id);
        if (track.getType?.() === 'audio') {
          this.users[id].audio = track;
          this.users[id].mute = !!track.isMuted?.();
        } else {
          this.users[id].video = track;
          this.users[id].videoType = track.videoType === 'desktop' ? 'desktop' : 'camera';
        }
      });

      conference.on(jsMeet.events.conference.PARTICIPANT_PROPERTY_CHANGED, (e: any) => {
        const id = e?._id;
        const props = e?._properties;
        if (!id || !this.users[id] || !props) return;
        this.users[id].properties = { ...this.users[id].properties, ...props };
        useLocalStore().calculateUsersOnScreen();
      });

      conference.addCommandListener?.('pos', (e: any) => {
        try {
          const pos = JSON.parse(e.value);
          if (pos?.id) this.updateUserPosition(pos.id, { x: pos.x, y: pos.y });
        } catch {
          // ignore
        }
      });

      conference.join();
      this.conferenceObject = conference;
      this.error = undefined;
    },

    sendTextMessage(txt: string) {
      this.conferenceObject?.sendTextMessage?.(txt);
    },

    leaveConference() {
      this.conferenceObject?.leave?.();
      this.conferenceObject = undefined;
      this.isJoined = false;
      this.isJoining = false;
      this.users = {};
      this.messages = [];
      this.error = undefined;
    },
  },
});

