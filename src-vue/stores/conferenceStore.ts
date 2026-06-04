import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { spreadInitialUserPosition } from '@/constants/pan';
import { mediaDebug } from '@/utils/mediaDebug';
import { conferenceNameDefault } from '@/config/jitsiOptions';
import { applyChatEdit, createChatMessage } from '@/utils/chatMessage';
import { displayNameFromParticipant } from '@/utils/jitsiParticipant';

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
  /** Plain display-name snapshot — never store a Jitsi participant object. */
  user?: { _displayName?: string };
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
  /** Bumped whenever `users` is replaced so dependents can watch a stable signal. */
  usersEpoch: number;
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
    users: {},
    usersEpoch: 0,
    displayName: 'Friendly Sphere',
    error: undefined,
    messages: [],
  }),
  actions: {
    setConferenceName(name: string) {
      this.conferenceName = name;
    },
    commitUsers(next: Record<string, RemoteUser>) {
      this.users = next;
      this.usersEpoch += 1;
    },
    patchUser(id: string, patch: Partial<RemoteUser>, bumpEpoch = true) {
      const user = this.users[id];
      if (!user) return;
      this.users = { ...this.users, [id]: { ...user, ...patch } };
      if (bumpEpoch) this.usersEpoch += 1;
    },
    addUser(id: string, participant?: unknown) {
      const displayName = displayNameFromParticipant(participant);
      if (this.users[id]) {
        if (displayName) this.updateUserDisplayName(id, displayName);
        return;
      }
      const local = useLocalStore();
      const existing = Object.values(this.users).map((u) => u.pos);
      if (local.id && local.id !== id) {
        existing.push(local.pos);
      }
      this.commitUsers({
        ...this.users,
        [id]: {
          id,
          mute: false,
          speaking: false,
          volume: 1,
          pos: spreadInitialUserPosition(existing),
          properties: {},
          ...(displayName ? { user: { _displayName: displayName } } : {}),
        },
      });
    },
    setUserTrack(id: string, kind: 'audio' | 'video', track: JitsiTrack) {
      if (!this.users[id]) {
        mediaDebug('conferenceStore', 'setUserTrack:skipped', { id, kind, reason: 'unknown-user' });
        return;
      }
      if (kind === 'audio') {
        this.patchUser(id, { audio: markRaw(track), mute: track.isMuted() });
      } else if (track.isMuted?.()) {
        this.clearUserTrack(id, 'video');
      } else {
        this.patchUser(id, {
          video: markRaw(track),
          videoType: track.videoType === 'desktop' ? 'desktop' : 'camera',
        });
        mediaDebug('conferenceStore', 'setUserTrack:video', {
          id,
          muted: track.isMuted?.(),
          videoType: track.videoType === 'desktop' ? 'desktop' : 'camera',
          usersEpoch: this.usersEpoch,
        });
      }
    },
    clearUserTrack(id: string, kind: 'audio' | 'video') {
      if (!this.users[id]) return;
      if (kind === 'audio') {
        this.patchUser(id, { audio: undefined, mute: false });
      } else {
        this.patchUser(id, { video: undefined, videoType: undefined });
        mediaDebug('conferenceStore', 'clearUserTrack:video', { id, usersEpoch: this.usersEpoch });
      }
    },
    removeUser(id: string) {
      if (!(id in this.users)) return;
      const next = { ...this.users };
      delete next[id];
      this.commitUsers(next);
    },
    setDisplayName(name: string) {
      this.displayName = name;
    },
    updateUserDisplayName(id: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed || !this.users[id]) return;
      this.patchUser(id, {
        user: { ...this.users[id].user, _displayName: trimmed },
      });
    },
    updateUserPosition(id: string, pos: Vector2) {
      if (!this.users[id]) return;
      this.patchUser(id, { pos });
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
      this.usersEpoch += 1;
      this.messages = [];
      this.error = undefined;
      useSessionFeaturesStore().resetForLeave();
    },
  },
});
