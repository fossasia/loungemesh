import { defineStore } from 'pinia';
import { shallowReactive } from 'vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { conferenceNameDefault } from '@/config/jitsiOptions';

export type Vector2 = { x: number; y: number };

export type RemoteUser = {
  id: string;
  mute: boolean;
  volume: number;
  pos: Vector2;
  audio?: JitsiTrack;
  video?: JitsiTrack;
  videoType?: 'camera' | 'desktop';
  properties: Record<string, unknown>;
  user?: unknown;
};

export type ConferenceState = {
  conferenceObject?: JitsiConference;
  conferenceName: string;
  isJoined: boolean;
  isJoining: boolean;
  users: Record<string, RemoteUser>;
  displayName: string;
  error?: string;
  messages: Array<{ id: string; text: string; nr: number }>;
};

/** Conference UI state — media events sync via useMediaEngine. */
export const useConferenceStore = defineStore('conference', {
  state: (): ConferenceState => ({
    conferenceObject: undefined,
    conferenceName: conferenceNameDefault,
    isJoined: false,
    isJoining: false,
    /**
     * shallowReactive: each RemoteUser object is reactive at the top level only.
     * Nested track objects (JitsiTrack) are intentionally NOT deeply observed —
     * they are opaque SDK objects that change by reference, not property mutation.
     */
    users: shallowReactive({}),
    displayName: 'Friendly Sphere',
    error: undefined,
    messages: [],
  }),
  actions: {
    setConferenceName(name: string) {
      this.conferenceName = name;
    },
    addUser(id: string, user?: unknown) {
      this.users[id] = {
        id,
        mute: false,
        volume: 1,
        pos: { x: 0, y: 0 },
        properties: {},
        ...(user ? { user } : {}),
      };
    },
    removeUser(id: string) {
      delete this.users[id];
    },
    setDisplayName(name: string) {
      this.displayName = name;
    },
    updateUserPosition(id: string, pos: Vector2) {
      if (!this.users[id]) return;
      this.users[id].pos = pos;
    },
    sendTextMessage(txt: string) {
      getMediaEngineInstance().sendTextMessage(txt);
    },
    leaveConference() {
      this.conferenceObject = undefined;
      this.isJoined = false;
      this.isJoining = false;
      this.users = {};
      this.messages = [];
      this.error = undefined;
    },
  },
});
