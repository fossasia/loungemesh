import { defineStore } from 'pinia';
import { markRaw, shallowReactive } from 'vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { spreadInitialUserPosition } from '@/constants/pan';
import { conferenceNameDefault } from '@/config/jitsiOptions';
import { applyChatEdit, createChatMessage } from '@/utils/chatMessage';

export type Vector2 = { x: number; y: number };

export type RemoteUser = {
  id: string;
  mute: boolean;
  speaking: boolean;
  volume: number;
  pos: Vector2;
  audio?: JitsiTrack;
  video?: JitsiTrack;
  videoType?: 'camera' | 'desktop';
  properties: Record<string, unknown>;
  user?: unknown;
};

export type ChatMessage = {
  id: string;
  text: string;
  nr: number;
  messageId: string;
  editedAt?: number;
  history?: string[];
};

export type ConferenceState = {
  conferenceObject?: JitsiConference;
  conferenceName: string;
  isJoined: boolean;
  isJoining: boolean;
  users: Record<string, RemoteUser>;
  displayName: string;
  error?: string;
  messages: ChatMessage[];
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
    users: shallowReactive({}) as Record<string, RemoteUser>,
    displayName: 'Friendly Sphere',
    error: undefined,
    messages: [],
  }),
  actions: {
    setConferenceName(name: string) {
      this.conferenceName = name;
    },
    addUser(id: string, user?: unknown) {
      const existing = Object.values(this.users).map((u) => u.pos);
      this.users[id] = {
        id,
        mute: false,
        speaking: false,
        volume: 1,
        pos: spreadInitialUserPosition(existing),
        properties: {},
        ...(user ? { user: markRaw(user as object) } : {}),
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
    sendTextMessage(txt: string): boolean {
      return getMediaEngineInstance().sendTextMessage(txt);
    },
    appendChatMessage(msg: ChatMessage) {
      this.messages = [...this.messages, msg];
    },
    ingestChatMessage(id: string, text: string, nr: number) {
      if (this.messages.some((m) => m.nr === nr && m.id === id && m.text === text)) {
        return;
      }
      const pending = this.messages.findIndex(
        (m) => m.id === id && m.text === text && m.nr < 0,
      );
      if (pending >= 0) {
        const next = [...this.messages];
        const prev = next[pending];
        next[pending] = { ...prev, id, text, nr };
        this.messages = next;
        return;
      }
      this.messages = [...this.messages, createChatMessage(id, text, nr)];
    },
    editChatMessage(messageId: string, text: string, editedAt: number) {
      this.messages = applyChatEdit(this.messages, messageId, text, editedAt);
    },
    leaveConference() {
      this.conferenceObject = undefined;
      this.isJoined = false;
      this.isJoining = false;
      this.users = {};
      this.messages = [];
      this.error = undefined;
      useSessionFeaturesStore().resetForLeave();
    },
  },
});
