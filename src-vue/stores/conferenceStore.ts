import { defineStore } from 'pinia';
import { markRaw, toRaw } from 'vue';
import { isDesktopShareTrack } from '@/utils/screenshareCapture';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import type { JitsiConference, JitsiTrack } from '@/types/jitsi';
import { spreadInitialUserPosition } from '@/constants/pan';
import { mediaDebug } from '@/utils/mediaDebug';
import { conferenceNameDefault } from '@/config/jitsiOptions';
import { applyChatEdit, createChatMessage } from '@/utils/chatMessage';
import { decodeChatWireText } from '@/utils/chatWireFormat';
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
  screenshare?: JitsiTrack;
  screenshareAudio?: JitsiTrack;
  videoType?: 'camera' | 'desktop';
  properties: Record<string, unknown>;
  /** Plain display-name snapshot — never store a Jitsi participant object. */
  user?: { _displayName?: string };
  email?: string;
  userKey?: string;
  lastSeen?: number;
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
    addUser(id: string, participant?: unknown, userKey?: string) {
      const displayName = displayNameFromParticipant(participant);
      if (this.users[id]) {
        if (displayName) this.updateUserDisplayName(id, displayName);
        if (userKey) this.patchUser(id, { userKey }, false);
        this.recordUserHeartbeat(id);
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
          userKey,
          lastSeen: Date.now(),
        },
      });
    },
    dedupeUserByKey(newId: string, userKey: string) {
      if (!userKey) return;
      for (const [id, user] of Object.entries(this.users)) {
        if (id !== newId && user.userKey === userKey) {
          const next = { ...this.users };
          delete next[id];
          this.commitUsers(next);
          break;
        }
      }
    },
    recordUserHeartbeat(id: string) {
      if (this.users[id]) {
        this.users[id].lastSeen = Date.now();
      }
    },
    reconcileUsers(liveParticipantIds: string[]) {
      const set = new Set(liveParticipantIds);
      let changed = false;
      const next = { ...this.users };
      for (const id of Object.keys(this.users)) {
        if (!set.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      if (changed) {
        this.commitUsers(next);
      }
    },
    pruneStaleUsers(timeoutMs = 45000, preserveIds: string[] = []) {
      const now = Date.now();
      const preserveSet = new Set(preserveIds);
      let changed = false;
      const next = { ...this.users };
      for (const [id, user] of Object.entries(this.users)) {
        if (!preserveSet.has(id) && user.lastSeen && now - user.lastSeen > timeoutMs) {
          delete next[id];
          changed = true;
        }
      }
      if (changed) {
        this.commitUsers(next);
      }
    },
    setUserTrack(id: string, kind: 'audio' | 'video' | 'screenshareAudio', track: JitsiTrack) {
      if (!this.users[id]) {
        mediaDebug('conferenceStore', 'setUserTrack:skipped', { id, kind, reason: 'unknown-user' });
        return;
      }
      if (kind === 'audio') {
        this.patchUser(id, { audio: markRaw(track), mute: track.isMuted() });
      } else if (kind === 'screenshareAudio') {
        this.patchUser(id, { screenshareAudio: markRaw(track) });
      } else if (track.isMuted?.()) {
        const current = this.users[id];
        if (
          isDesktopShareTrack(track) ||
          Boolean(current.screenshare && toRaw(current.screenshare) === toRaw(track))
        ) {
          this.clearUserTrack(id, 'screenshare');
        } else {
          this.clearUserTrack(id, 'video');
        }
      } else {
        const current = this.users[id];
        if (isDesktopShareTrack(track)) {
          const movedFromCamera = Boolean(current.video && toRaw(current.video) === toRaw(track));
          this.patchUser(id, {
            screenshare: markRaw(track),
            ...(movedFromCamera ? { video: undefined, videoType: undefined } : {}),
          });
        } else {
          const movedFromScreen = Boolean(
            current.screenshare && toRaw(current.screenshare) === toRaw(track),
          );
          this.patchUser(id, {
            video: markRaw(track),
            videoType: 'camera',
            ...(movedFromScreen ? { screenshare: undefined } : {}),
          });
        }
        mediaDebug('conferenceStore', 'setUserTrack:video', {
          id,
          muted: track.isMuted?.(),
          videoType: isDesktopShareTrack(track) ? 'desktop' : 'camera',
          usersEpoch: this.usersEpoch,
        });
      }
    },
    clearUserTrack(id: string, kind: 'audio' | 'video' | 'screenshare' | 'screenshareAudio') {
      if (!this.users[id]) return;
      if (kind === 'audio') {
        this.patchUser(id, { audio: undefined, mute: false });
      } else if (kind === 'screenshareAudio') {
        this.patchUser(id, { screenshareAudio: undefined });
      } else if (kind === 'screenshare') {
        this.patchUser(id, { screenshare: undefined });
        mediaDebug('conferenceStore', 'clearUserTrack:screenshare', { id, usersEpoch: this.usersEpoch });
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
      const { messageId: wireId, text: displayText } = decodeChatWireText(text);
      if (wireId) {
        const existing = this.messages.findIndex((m) => m.messageId === wireId);
        if (existing >= 0) {
          if (this.messages[existing].nr < 0 && nr >= 0) {
            const next = [...this.messages];
            next[existing] = { ...next[existing], id, nr };
            this.messages = next;
          }
          return;
        }
      }
      if (this.messages.some((m) => m.nr === nr && m.id === id && m.text === displayText)) {
        return;
      }
      const pending = this.messages.findIndex(
        (m) => m.id === id && m.text === displayText && m.nr < 0,
      );
      if (pending >= 0) {
        const next = [...this.messages];
        const prev = next[pending];
        next[pending] = {
          ...prev,
          id,
          text: displayText,
          nr,
          messageId: wireId ?? prev.messageId,
        };
        this.messages = next;
        return;
      }
      this.messages = [...this.messages, createChatMessage(id, displayText, nr, wireId)];
    },
    editChatMessage(
      messageId: string,
      text: string,
      editedAt: number,
      nr?: number,
      authorId?: string,
    ) {
      this.messages = applyChatEdit(
        this.messages,
        { messageId, nr, authorId },
        text,
        editedAt,
      );
    },
    removeChatMessage(messageId: string, nr?: number) {
      this.messages = this.messages.filter((m) => {
        if (messageId && m.messageId === messageId) return false;
        if (nr !== undefined && m.nr === nr) return false;
        return true;
      });
    },
    /** Drop Jitsi join state without clearing session features (transient reconnect). */
    clearJoinState() {
      this.conferenceObject = undefined;
      this.isJoined = false;
      this.isJoining = false;
      this.users = {};
      this.usersEpoch += 1;
    },
    leaveConference() {
      this.clearJoinState();
      this.messages = [];
      this.error = undefined;
      useSessionFeaturesStore().resetForLeave();
    },
  },
});
