import { defineStore } from 'pinia';
import { useLocalStore } from '@/stores/localStore';
import {
  mergeWhiteboardStroke,
  type WhiteboardStroke,
} from '@/utils/whiteboardSync';
import { REACTION_DISPLAY_MS } from '@/constants/sessionEmojis';
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
import { mergePolls } from '@/utils/sessionPoll';
import {
  loadPersistedHostRoomSettings,
  persistHostRoomSettings,
} from '@/utils/hostRoomSettings';
import type { NotesCommand } from '@/utils/notesSync';
import { decodeNotesFromWire } from '@/utils/notesSync';
import type { RoomBackgroundCommand } from '@/utils/roomBackgroundSync';

export type LobbyEntry = { id: string; name: string };
export type PollOption = { id: string; label: string; votes: number; voters?: string[] };
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
    gridBackgroundUrl: '',
    notesTemplate: '',
    hostSettingsSessionId: '',
    roomBgAssembly: null as { total: number; parts: Record<number, string> } | null,
    notesAssembly: null as { total: number; parts: Record<number, string> } | null,
    whiteboardStrokes: [] as WhiteboardStroke[],
    roomDefaults: defaultUserGrants(),
    userGrants: {} as Record<string, Partial<UserGrants>>,
    panel: '' as '' | 'reactions' | 'poll' | 'moderator' | 'notes' | 'whiteboard',
    pendingHostClaim: false,
    notesActivitySeq: 0,
    notesSeenSeq: 0,
    whiteboardActivitySeq: 0,
    whiteboardSeenSeq: 0,
    pollActivitySeq: 0,
    pollSeenSeq: 0,
  }),
  getters: {
    hasUnreadNotes(): boolean {
      return this.notesActivitySeq > this.notesSeenSeq;
    },
    hasUnreadWhiteboard(): boolean {
      return this.whiteboardActivitySeq > this.whiteboardSeenSeq;
    },
    hasUnreadPoll(): boolean {
      return this.pollActivitySeq > this.pollSeenSeq;
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
      this.userReactions = { ...this.userReactions, [userId]: { emoji, at } };
      window.setTimeout(() => {
        if (this.userReactions[userId]?.at !== at) return;
        const next = { ...this.userReactions };
        delete next[userId];
        this.userReactions = next;
      }, REACTION_DISPLAY_MS);
    },
    applyPoll(poll: ActivePoll | null) {
      if (!poll) {
        this.activePoll = null;
        this.myPollVote = '';
        return;
      }
      const pollIdChanged = this.activePoll?.id !== poll.id;
      this.activePoll = mergePolls(poll, this.activePoll);
      if (pollIdChanged) this.myPollVote = '';
      this.syncMyPollVoteFromPoll();
    },
    syncMyPollVoteFromPoll() {
      const local = useLocalStore();
      const voterId = local.id;
      if (!voterId || !this.activePoll) return;
      const tracksVoters = this.activePoll.options.some((o) => (o.voters?.length ?? 0) > 0);
      if (!tracksVoters) return;
      const voted = this.activePoll.options.find((o) => o.voters?.includes(voterId));
      this.myPollVote = voted?.id ?? '';
    },
    addWhiteboardStroke(stroke: WhiteboardStroke) {
      this.whiteboardStrokes = mergeWhiteboardStroke(this.whiteboardStrokes, stroke);
    },
    clearWhiteboard() {
      this.whiteboardStrokes = [];
    },
    loadPersistedHostSettings(sessionId: string) {
      if (!sessionId) return;
      this.hostSettingsSessionId = sessionId;
      if (!this.pendingHostClaim) return;
      const saved = loadPersistedHostRoomSettings(sessionId);
      if (!saved) return;
      if (saved.gridBackgroundUrl) this.gridBackgroundUrl = saved.gridBackgroundUrl;
      if (saved.notesTemplate) this.notesTemplate = saved.notesTemplate;
    },
    persistHostSettings() {
      const sessionId = this.hostSettingsSessionId;
      if (!sessionId) return;
      persistHostRoomSettings(sessionId, {
        gridBackgroundUrl: this.gridBackgroundUrl,
        notesTemplate: this.notesTemplate,
      });
    },
    setGridBackgroundUrl(url: string) {
      this.gridBackgroundUrl = url;
      this.persistHostSettings();
    },
    clearGridBackground() {
      this.gridBackgroundUrl = '';
      this.roomBgAssembly = null;
      this.persistHostSettings();
    },
    applyNotesCommand(command: NotesCommand) {
      if (command.action === 'clear') {
        this.sharedNotes = '';
        this.notesAssembly = null;
        this.bumpNotesActivity();
        return;
      }
      if (command.action === 'begin') {
        this.notesAssembly = { total: command.total, parts: {} };
        return;
      }
      if (!this.notesAssembly) return;
      this.notesAssembly.parts[command.index] = command.data;
      if (Object.keys(this.notesAssembly.parts).length !== this.notesAssembly.total) return;
      const encoded = Array.from({ length: this.notesAssembly.total }, (_, index) => {
        return this.notesAssembly?.parts[index] ?? '';
      }).join('');
      this.sharedNotes = decodeNotesFromWire(encoded);
      this.notesAssembly = null;
      this.bumpNotesActivity();
    },
    applyRoomBackgroundCommand(command: RoomBackgroundCommand) {
      if (command.action === 'clear') {
        this.gridBackgroundUrl = '';
        this.roomBgAssembly = null;
        return;
      }
      if (command.action === 'begin') {
        this.roomBgAssembly = { total: command.total, parts: {} };
        return;
      }
      if (!this.roomBgAssembly) return;
      this.roomBgAssembly.parts[command.index] = command.data;
      if (Object.keys(this.roomBgAssembly.parts).length !== this.roomBgAssembly.total) return;
      const url = Array.from({ length: this.roomBgAssembly.total }, (_, index) => {
        return this.roomBgAssembly?.parts[index] ?? '';
      }).join('');
      this.gridBackgroundUrl = url;
      this.roomBgAssembly = null;
    },
    setNotesTemplate(text: string) {
      this.notesTemplate = text;
      this.persistHostSettings();
    },
    clearNotesTemplate() {
      this.notesTemplate = '';
      this.persistHostSettings();
    },
    /** Pre-fill shared notes from the host template when the session is still blank. */
    applyNotesTemplateIfNeeded(): boolean {
      if (!this.isHost || !this.notesTemplate.trim() || this.sharedNotes.trim()) return false;
      this.sharedNotes = this.notesTemplate;
      return true;
    },
    /** Replace shared notes with the host template (host only). */
    resetSharedNotesToTemplate(): boolean {
      if (!this.isHost || !this.notesTemplate.trim()) return false;
      this.sharedNotes = this.notesTemplate;
      this.bumpNotesActivity();
      return true;
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
    bumpPollActivity() {
      if (this.panel === 'poll') {
        this.markPollSeen();
        return;
      }
      this.pollActivitySeq += 1;
    },
    markPollSeen() {
      this.pollSeenSeq = this.pollActivitySeq;
    },
    togglePanel(name: typeof this.panel) {
      if (name === 'notes' && !this.canUseNotes) return;
      if (name === 'whiteboard' && !this.canUseWhiteboard) return;
      const opening = this.panel !== name;
      this.panel = opening ? name : '';
      if (opening && name === 'notes') this.markNotesSeen();
      if (opening && name === 'whiteboard') this.markWhiteboardSeen();
      if (opening && name === 'poll') this.markPollSeen();
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
      this.gridBackgroundUrl = '';
      this.notesTemplate = '';
      this.hostSettingsSessionId = '';
      this.roomBgAssembly = null;
      this.notesAssembly = null;
      this.notesActivitySeq = 0;
      this.notesSeenSeq = 0;
      this.whiteboardActivitySeq = 0;
      this.whiteboardSeenSeq = 0;
      this.pollActivitySeq = 0;
      this.pollSeenSeq = 0;
    },
  },
});
