import { defineStore } from 'pinia';
import { useLocalStore } from '@/stores/localStore';
import {
  mergeWhiteboardStroke,
  type WhiteboardStroke,
} from '@/utils/whiteboardSync';
import {
  defaultUserGrants,
  type FeatureKey,
  type UserGrants,
} from '@/types/userGrants';
import {
  effectiveGrants,
  legacyAccessToDefaults,
  mergeGrants,
  type AccessCommandPayload,
} from '@/utils/sessionAccess';

export type LobbyEntry = { id: string; name: string };
export type PollOption = { id: string; label: string; votes: number };
export type ActivePoll = {
  id: string;
  question: string;
  options: PollOption[];
  open: boolean;
};
export type UserReaction = { emoji: string; at: number };
export type { WhiteboardStroke };

export const useSessionFeaturesStore = defineStore('sessionFeatures', {
  state: () => ({
    hostId: '',
    lobbyEnabled: false,
    lobbyApproved: {} as Record<string, boolean>,
    lobbyWaiting: [] as LobbyEntry[],
    localLobbyPending: false,
    handRaised: false,
    userReactions: {} as Record<string, UserReaction>,
    activePoll: null as ActivePoll | null,
    myPollVote: '',
    sharedNotes: '',
    whiteboardStrokes: [] as WhiteboardStroke[],
    roomDefaults: defaultUserGrants(),
    userGrants: {} as Record<string, Partial<UserGrants>>,
    panel: '' as '' | 'reactions' | 'poll' | 'moderator' | 'notes' | 'whiteboard',
    pendingHostClaim: false,
    notesActivitySeq: 0,
    notesSeenSeq: 0,
    whiteboardActivitySeq: 0,
    whiteboardSeenSeq: 0,
  }),
  getters: {
    hasUnreadNotes(): boolean {
      return this.notesActivitySeq > this.notesSeenSeq;
    },
    hasUnreadWhiteboard(): boolean {
      return this.whiteboardActivitySeq > this.whiteboardSeenSeq;
    },
    isHost(): boolean {
      const local = useLocalStore();
      if (!local.id) return false;
      if (!this.hostId) return true;
      return this.hostId === local.id;
    },
    localGrants(): UserGrants {
      const local = useLocalStore();
      return effectiveGrants(
        local.id,
        this.roomDefaults,
        this.userGrants,
        this.isHost,
      );
    },
    canUseNotes(): boolean {
      return this.localGrants.notes;
    },
    canUseWhiteboard(): boolean {
      return this.localGrants.whiteboard;
    },
    canUsePoll(): boolean {
      return this.localGrants.poll;
    },
    canUseStage(): boolean {
      return this.localGrants.stage;
    },
    canClearWhiteboard(): boolean {
      return this.isHost;
    },
    isLobbyBlocked(): boolean {
      if (!this.lobbyEnabled) return false;
      if (this.isHost) return false;
      const local = useLocalStore();
      if (!local.id) return this.localLobbyPending;
      return this.localLobbyPending || !this.lobbyApproved[local.id];
    },
    grantsForUser:
      (state) =>
      (userId: string): UserGrants =>
        effectiveGrants(userId, state.roomDefaults, state.userGrants, userId === state.hostId),
  },
  actions: {
    setHost(id: string) {
      this.hostId = id;
    },
    approveLobby(id: string) {
      this.lobbyApproved[id] = true;
      this.lobbyWaiting = this.lobbyWaiting.filter((e) => e.id !== id);
    },
    addLobbyWaiter(entry: LobbyEntry) {
      if (!this.lobbyWaiting.some((e) => e.id === entry.id)) {
        this.lobbyWaiting.push(entry);
      }
    },
    setReaction(userId: string, emoji: string) {
      const at = Date.now();
      this.userReactions[userId] = { emoji, at };
      window.setTimeout(() => {
        if (this.userReactions[userId]?.at === at) {
          delete this.userReactions[userId];
        }
      }, 4000);
    },
    applyPoll(poll: ActivePoll | null) {
      if (!poll) {
        this.activePoll = null;
        this.myPollVote = '';
        return;
      }
      if (this.activePoll?.id !== poll.id) this.myPollVote = '';
      this.activePoll = poll;
    },
    addWhiteboardStroke(stroke: WhiteboardStroke) {
      this.whiteboardStrokes = mergeWhiteboardStroke(this.whiteboardStrokes, stroke);
    },
    clearWhiteboard() {
      this.whiteboardStrokes = [];
    },
    setRoomDefault(key: FeatureKey, value: boolean) {
      this.roomDefaults = { ...this.roomDefaults, [key]: value };
    },
    setUserGrant(userId: string, key: FeatureKey, value: boolean) {
      const current = this.grantsForUser(userId);
      this.userGrants[userId] = { ...current, [key]: value };
    },
    applyAccessUpdate(data: AccessCommandPayload & { notes?: boolean; whiteboard?: boolean }) {
      const legacy = legacyAccessToDefaults(data);
      if (Object.keys(legacy).length) {
        this.roomDefaults = mergeGrants(this.roomDefaults, legacy);
      }
      if (data.defaults) {
        this.roomDefaults = mergeGrants(this.roomDefaults, data.defaults);
      }
      if (data.userId && data.grants) {
        const base = this.grantsForUser(data.userId);
        this.userGrants[data.userId] = mergeGrants(base, data.grants);
      }
    },
    bumpNotesActivity() {
      if (this.panel === 'notes') {
        this.markNotesSeen();
        return;
      }
      this.notesActivitySeq += 1;
    },
    markNotesSeen() {
      this.notesSeenSeq = this.notesActivitySeq;
    },
    bumpWhiteboardActivity() {
      if (this.panel === 'whiteboard') {
        this.markWhiteboardSeen();
        return;
      }
      this.whiteboardActivitySeq += 1;
    },
    markWhiteboardSeen() {
      this.whiteboardSeenSeq = this.whiteboardActivitySeq;
    },
    togglePanel(name: typeof this.panel) {
      if (name === 'notes' && !this.canUseNotes) return;
      if (name === 'whiteboard' && !this.canUseWhiteboard) return;
      const opening = this.panel !== name;
      this.panel = opening ? name : '';
      if (opening && name === 'notes') this.markNotesSeen();
      if (opening && name === 'whiteboard') this.markWhiteboardSeen();
    },
    resetHostForJoin() {
      this.hostId = '';
      this.pendingHostClaim = true;
    },
    resetForLeave() {
      this.hostId = '';
      this.panel = '';
      this.localLobbyPending = false;
      this.lobbyWaiting = [];
      this.pendingHostClaim = false;
      this.roomDefaults = defaultUserGrants();
      this.userGrants = {};
      this.notesActivitySeq = 0;
      this.notesSeenSeq = 0;
      this.whiteboardActivitySeq = 0;
      this.whiteboardSeenSeq = 0;
    },
  },
});
