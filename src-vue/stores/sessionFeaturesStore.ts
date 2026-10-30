import { defineStore } from 'pinia';
import * as Y from 'yjs';
import { getStageOccupantId } from '@/components/stage/getStageOccupantId';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import {
  mergeWhiteboardStroke,
  type WhiteboardStroke,
} from '@/utils/whiteboardSync';
import { REACTION_DISPLAY_MS } from '@/constants/sessionEmojis';
import {
  defaultUserGrants,
  fullUserGrants,
  type FeatureKey,
  type UserGrants,
} from '@/types/userGrants';
import {
  legacyAccessToDefaults,
  mergeGrants,
  type AccessCommandPayload,
} from '@/utils/sessionAccess';
import {
  DEFAULT_ENABLED_FEATURES,
  type GatedFeatureKey,
} from '@/utils/featureAccess';
import { mergePolls } from '@/utils/sessionPoll';

import type { NotesCommand } from '@/utils/notesSync';
import { decodeNotesFromWire } from '@/utils/notesSync';
import type { RoomBackgroundCommand } from '@/utils/roomBackgroundSync';
import { broadcastHostRoomSettings } from '@/utils/hostRoomSettings';
import { broadcastYjsState, notesDocumentHasContent, seedNotesDocument } from '@/utils/notesYjsSync';

function gatedFeatureAllowed(
  store: {
    enabledFeatures: Partial<Record<GatedFeatureKey, boolean>>;
    isHost: boolean;
    isModerator: boolean;
    eventyayMeet: boolean;
    capabilities: string[];
    userRole: 'host' | 'moderator' | 'attendee';
    userGrants: Record<string, Partial<UserGrants>>;
  },
  feature: 'chat' | 'notes' | 'whiteboard' | 'poll',
  capability?: string,
): boolean {
  if (store.enabledFeatures[feature] === false) return false;
  if (store.isHost || store.isModerator) return true;
  if (store.eventyayMeet && store.capabilities.length > 0) {
    return capability ? store.capabilities.includes(capability) : true;
  }
  const local = useLocalStore();
  if (!local.id) return true;
  return store.userGrants[local.id]?.[feature] !== false;
}

export type LobbyEntry = { id: string; name: string; email?: string; reason?: string };
export type PollOption = { id: string; label: string; votes: number; voters?: string[] };
export type ActivePoll = {
  id: string;
  question: string;
  options: PollOption[];
  open: boolean;
};
export type PollRequest = {
  id: string;
  question: string;
  options: string[];
  requesterId: string;
  requesterName: string;
  createdAt: number;
};
export type UserReaction = { emoji: string; at: number };
export type { WhiteboardStroke };

export type ModerationChangeType = 'whiteboard' | 'notes';
export type ModerationChange = {
  id: string;
  type: ModerationChangeType;
  authorId: string;
  authorName: string;
  payload: any;
  timestamp: number;
  autoApproveTimer?: any;
};

export type StagePipCorner = 'tl' | 'tr' | 'bl' | 'br';

export type StageLayout = {
  pipCorner: StagePipCorner;
  pipOffset: { x: number; y: number };
  scale: number;
  expanded: boolean;
};

export function defaultStageLayout(): StageLayout {
  return {
    pipCorner: 'br',
    pipOffset: { x: 0, y: 0 },
    scale: 1,
    expanded: false,
  };
}

export const useSessionFeaturesStore = defineStore('sessionFeatures', {
  state: () => ({
    isVerifiedHost: false,
    isVerifiedModerator: false,
    isInvited: false,
    allowParticipantRecording: false,
    hostId: '',
    lobbyEnabled: true,
    lobbyForm: 'name' as 'name' | 'details',
    moderatorEmails: [] as string[],
    guestEmails: [] as string[],
    lobbyApproved: {} as Record<string, boolean>,
    lobbyWaiting: [] as LobbyEntry[],
    localLobbyPending: false,
    lobbyRejected: false,
    handRaised: false,
    userReactions: {} as Record<string, UserReaction>,
    activePoll: null as ActivePoll | null,
    myPollVote: '',
    pendingPollRequests: [] as PollRequest[],
    myPendingPollRequestId: '',
    pollRequestNotice: '',
    sharedNotes: '',
    gridBackgroundUrl: '',
    notesTemplate: '',
    hostSettingsSessionId: '',
    roomBgAssembly: null as { total: number; parts: Record<number, string> } | null,
    notesAssembly: null as { total: number; parts: Record<number, string> } | null,
    ydoc: new Y.Doc(),
    yjsAssembly: null as { total: number; parts: Record<number, string> } | null,
    _yjsListener: null as ((update: Uint8Array, origin: any) => void) | null,
    whiteboardStrokes: [] as WhiteboardStroke[],
    whiteboardSnapshots: [] as Array<WhiteboardStroke[]>,
    roomDefaults: defaultUserGrants(),
    userGrants: {} as Record<string, Partial<UserGrants>>,
    panel: '' as '' | 'reactions' | 'poll' | 'moderator' | 'participants' | 'notes' | 'whiteboard' | 'chat',
    pendingHostClaim: false,
    hostEmail: '',
    notesActivitySeq: 0,
    notesSeenSeq: 0,
    whiteboardActivitySeq: 0,
    whiteboardSeenSeq: 0,
    pollActivitySeq: 0,
    pollSeenSeq: 0,
    stagePromotionEnabled: false,
    stageOccupantId: '',
    stageLayout: defaultStageLayout(),
    stageMessage: '',
    stageInvitationPending: false,
    invitedStageUserId: '',
    meetingExists: false,
    configLoaded: false,
    isFetchingConfig: false,
    eventyayMeet: false,
    eventyayRole: '' as string,
    capabilities: [] as string[],
    pendingModerationChanges: [] as ModerationChange[],
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES } as Record<GatedFeatureKey, boolean>,
    roleSnapshotToken: '' as string,
  }),
  getters: {
    canModerate(): boolean {
      if (this.eventyayMeet && this.capabilities.length > 0) {
        return this.capabilities.includes('moderate');
      }
      return this.isHost || this.isModerator;
    },
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
      if (this.isVerifiedHost) return true;
      if (this.eventyayMeet) return false;
      const local = useLocalStore();
      if (!local.id || this.isFetchingConfig) return false;
      return !!this.hostId && this.hostId === local.id;
    },
    isModerator(): boolean {
      if (this.isVerifiedHost || this.isVerifiedModerator) return true;
      if (this.eventyayMeet) return false;
      const local = useLocalStore();
      if (!local.id) return false;
      if (this.hostId === local.id) return true;
      return !!this.userGrants[local.id]?.moderator;
    },
    isAttendee(): boolean {
      return !this.isHost && !this.isModerator;
    },
    userRole(): 'host' | 'moderator' | 'attendee' {
      if (this.isHost) return 'host';
      if (this.isModerator) return 'moderator';
      return 'attendee';
    },
    isReviewer(): boolean {
      return this.eventyayRole === 'moderator' || this.eventyayRole === 'reviewer';
    },
    canUseNotes(): boolean {
      return gatedFeatureAllowed(this, 'notes', 'notes');
    },
    canUseWhiteboard(): boolean {
      return gatedFeatureAllowed(this, 'whiteboard', 'whiteboard');
    },
    canUsePoll(): boolean {
      return gatedFeatureAllowed(this, 'poll', 'poll_manage');
    },
    canUseChat(): boolean {
      return gatedFeatureAllowed(this, 'chat');
    },
    canRequestPoll(): boolean {
      if (this.enabledFeatures.poll === false) return false;
      if (this.isHost || this.isModerator) return false;
      return this.canUsePoll || this.eventyayMeet;
    },
    canManagePoll(): boolean {
      if (this.enabledFeatures.poll === false) return false;
      if (this.isHost || this.isModerator) return true;
      if (
        this.eventyayMeet &&
        (this.capabilities.includes('poll_manage') || this.capabilities.includes('moderate'))
      ) {
        return true;
      }
      return false;
    },
    canAccessPoll(): boolean {
      if (this.enabledFeatures.poll === false) return false;
      return this.canUsePoll || this.isHost || this.isModerator || this.eventyayMeet;
    },
    myPendingPollRequest(): PollRequest | undefined {
      const local = useLocalStore();
      return this.pendingPollRequests.find(
        (r) => r.id === this.myPendingPollRequestId || (local.id && r.requesterId === local.id),
      );
    },
    canPromoteToStage(): boolean {
      if (this.enabledFeatures.stage === false || !this.stagePromotionEnabled) return false;
      if (this.eventyayMeet && this.capabilities.length > 0) {
        return this.capabilities.includes('moderate');
      }
      return this.isHost;
    },
    isStageModeActive(): boolean {
      const conference = useConferenceStore();
      const local = useLocalStore();
      if (getStageOccupantId(this.stageOccupantId, conference.users)) return true;
      return local.onStage && !!local.id;
    },
    isLocalStageOccupant(): boolean {
      const local = useLocalStore();
      if (!local.id) return false;
      const conference = useConferenceStore();
      const occupant = getStageOccupantId(this.stageOccupantId, conference.users);
      if (occupant) return occupant === local.id;
      return local.onStage;
    },
    canClearWhiteboard(): boolean {
      if (this.enabledFeatures.whiteboard === false) return false;
      if (this.eventyayMeet && this.capabilities.length > 0) {
        return this.capabilities.includes('moderate');
      }
      return this.isHost || this.isModerator;
    },
    isLobbyBlocked(): boolean {
      if (!this.lobbyEnabled) return false;
      if (this.isHost || this.isModerator) return false;
      if (this.isInvited) return false;
      const local = useLocalStore();
      if (!local.id) return this.localLobbyPending;
      return this.localLobbyPending || !this.lobbyApproved[local.id];
    },
    grantsForUser:
      (state) =>
      (userId: string): UserGrants => {
        if (userId && userId === state.hostId) return fullUserGrants();
        const grant = state.userGrants[userId] ?? {};
        return {
          notes: grant.notes !== false,
          whiteboard: grant.whiteboard !== false,
          poll: grant.poll !== false,
          moderator: !!grant.moderator,
          chat: grant.chat !== false,
        };
      },
  },
  actions: {
    setHost(id: string) {
      this.hostId = id;
    },
    admitParticipantEmail(id: string, email?: string) {
      const known = (email || '').trim().toLowerCase();
      if (!id || !known) return;
      const allowed = [this.hostEmail, ...this.moderatorEmails, ...this.guestEmails];
      if (allowed.some((item) => (item || '').trim().toLowerCase() === known)) {
        this.approveLobby(id);
      }
    },
    approveLobby(id: string) {
      this.lobbyApproved[id] = true;
      this.lobbyWaiting = this.lobbyWaiting.filter((e) => e.id !== id);
    },
    rejectLobby(id: string) {
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
    applyPoll(poll: ActivePoll | null, isLocal = false) {
      if (!poll) {
        this.activePoll = null;
        this.myPollVote = '';
        /* v8 ignore start */
        if (isLocal) {
          const roomName = window.location.pathname.split('/').pop();
          if (roomName) {
            fetch(`/api/meetings/state/${roomName}/poll`, {
              method: 'DELETE',
            }).catch((err) => console.error('Failed to clear poll:', err));
          }
        }
        /* v8 ignore stop */
        return;
      }
      const pollIdChanged = this.activePoll?.id !== poll.id;
      this.activePoll = mergePolls(poll, this.activePoll);
      if (pollIdChanged) this.myPollVote = '';
      this.syncMyPollVoteFromPoll();
      /* v8 ignore start */
      if (isLocal) {
        const roomName = window.location.pathname.split('/').pop();
        if (roomName) {
          fetch(`/api/meetings/state/${roomName}/poll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poll: this.activePoll }),
          }).catch((err) => console.error('Failed to save poll:', err));
        }
      }
      /* v8 ignore stop */
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
    addPollRequest(req: PollRequest) {
      if (!this.pendingPollRequests.some((r) => r.id === req.id)) {
        this.pendingPollRequests.push(req);
      }
    },
    removePollRequest(id: string) {
      this.pendingPollRequests = this.pendingPollRequests.filter((r) => r.id !== id);
      if (this.myPendingPollRequestId === id) {
        this.myPendingPollRequestId = '';
      }
    },
    clearPollRequests() {
      this.pendingPollRequests = [];
      this.myPendingPollRequestId = '';
      this.pollRequestNotice = '';
    },
    addWhiteboardStroke(stroke: WhiteboardStroke, isLocal = false) {
      this.whiteboardStrokes = mergeWhiteboardStroke(this.whiteboardStrokes, stroke);
      /* v8 ignore start */
      if (isLocal) {
        const roomName = window.location.pathname.split('/').pop();
        if (roomName) {
          fetch(`/api/meetings/state/${roomName}/whiteboard/stroke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stroke }),
          }).catch((err) => console.error('Failed to save stroke:', err));
        }
      }
      /* v8 ignore stop */
    },
    clearWhiteboard(isLocal = false) {
      if (this.whiteboardStrokes.length) {
        this.whiteboardSnapshots.push([...this.whiteboardStrokes]);
      }
      this.whiteboardStrokes = [];
      /* v8 ignore start */
      if (isLocal) {
        const roomName = window.location.pathname.split('/').pop();
        if (roomName) {
          fetch(`/api/meetings/state/${roomName}/whiteboard/clear`, {
            method: 'POST',
          }).catch((err) => console.error('Failed to clear whiteboard:', err));
        }
      }
      /* v8 ignore stop */
    },
    loadPersistedHostSettings(sessionId: string) {
      if (!sessionId) return;
      this.hostSettingsSessionId = sessionId;
    },
    async setGridBackgroundUrl(url: string) {
      this.gridBackgroundUrl = url;
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        try {
          await fetch(`/api/meetings/state/${roomName}/background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gridBackgroundUrl: url }),
          });
        } catch (err) {
          console.error('Failed to save background:', err);
        }
      }
      /* v8 ignore stop */
    },
    clearGridBackground() {
      this.gridBackgroundUrl = '';
      this.roomBgAssembly = null;
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/state/${roomName}/background`, {
          method: 'DELETE',
        }).catch((err) => console.error('Failed to clear background:', err));
      }
      /* v8 ignore stop */
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
      /* v8 ignore start */
      if (command.action === 'reload') {
        const roomName = window.location.pathname.split('/').pop();
        if (roomName) {
          fetch(`/api/meetings/state/${roomName}/background`)
            .then((res) => res.json())
            .then((data) => {
              if (data && data.gridBackgroundUrl !== undefined) {
                this.gridBackgroundUrl = data.gridBackgroundUrl || '';
              } else if (data && data.backgroundUrl !== undefined) {
                this.gridBackgroundUrl = data.backgroundUrl || '';
              }
            })
            .catch((err) => console.error('Failed to reload background:', err));
        }
      }
      /* v8 ignore stop */
    },
    setNotesTemplate(text: string) {
      this.notesTemplate = text;
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/config/${roomName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notesTemplate: text }),
        }).catch((err) => console.error('Failed to save notes template:', err));
      }
      /* v8 ignore stop */
    },
    clearNotesTemplate() {
      this.notesTemplate = '';
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/config/${roomName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notesTemplate: '' }),
        }).catch((err) => console.error('Failed to clear notes template:', err));
      }
      /* v8 ignore stop */
    },
    updateSharedNotes(text: string, isLocal = false) {
      this.sharedNotes = text;
      this.bumpNotesActivity();
      /* v8 ignore start */
      if (isLocal) {
        const roomName = window.location.pathname.split('/').pop();
        if (roomName) {
          fetch(`/api/meetings/state/${roomName}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: text }),
          }).catch((err) => console.error('Failed to save notes:', err));
        }
      }
      /* v8 ignore stop */
    },
    /** Pre-fill shared notes from the host template when the session is still blank. */
    applyNotesTemplateIfNeeded(): boolean {
      if ((!this.isHost && !this.isModerator) || !this.notesTemplate.trim() || this.sharedNotes.trim()) return false;
      seedNotesDocument(this.ydoc, this.notesTemplate);
      this.updateSharedNotes(this.notesTemplate, true);
      return true;
    },
    publishNotesTemplate(engine: { sendCommand: (name: string, value: string) => void }): boolean {
      if ((!this.isHost && !this.isModerator) || !this.notesTemplate.trim()) return false;
      seedNotesDocument(this.ydoc, this.notesTemplate);
      this.updateSharedNotes(this.notesTemplate, true);
      broadcastYjsState(engine, this.ydoc);
      return true;
    },
    seedNotesDocumentIfEmpty() {
      if (notesDocumentHasContent(this.ydoc)) return;
      const seed = (this.sharedNotes || this.notesTemplate || '').trim();
      if (!seed) return;
      seedNotesDocument(this.ydoc, seed);
    },
    controlEmail(): string {
      const auth = useAuthStore();
      return (auth.user?.email || this.hostEmail || '').trim();
    },
    /** Replace shared notes with the room template. Host or moderator. */
    resetSharedNotesToTemplate(): boolean {
      if ((!this.isHost && !this.isModerator) || !this.notesTemplate.trim()) return false;
      this.updateSharedNotes(this.notesTemplate, true);
      return true;
    },
    setRoomDefault(key: FeatureKey, value: boolean) {
      this.roomDefaults = { ...this.roomDefaults, [key]: value };
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/state/${roomName}/access/defaults`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaults: this.roomDefaults }),
        }).catch((err) => console.error('Failed to save room defaults:', err));
      }
      /* v8 ignore stop */
    },
    setUserGrant(userId: string, key: FeatureKey, value: boolean) {
      const current = this.userGrants[userId] ?? {};
      this.userGrants[userId] = { ...current, [key]: value };
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/state/${roomName}/access/grants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, grants: this.userGrants[userId] }),
        }).catch((err) => console.error('Failed to save user grants:', err));
      }
      /* v8 ignore stop */
    },
    applyAccessUpdate(data: AccessCommandPayload & { notes?: boolean; whiteboard?: boolean }) {
      const legacy = legacyAccessToDefaults(data);
      if (Object.keys(legacy).length) {
        this.roomDefaults = mergeGrants(this.roomDefaults, legacy);
      }
      if (data.defaults) {
        this.roomDefaults = mergeGrants(this.roomDefaults, data.defaults);
      }
      if (data.userId && data.grants && Object.keys(data.grants).length > 0) {
        const current = this.userGrants[data.userId] ?? {};
        this.userGrants[data.userId] = { ...current, ...data.grants };
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
      if (name === 'poll' && !this.canAccessPoll) return;
      if (name === 'chat' && !this.canUseChat) return;
      if (name === 'moderator' && !this.isHost && !this.isModerator) return;
      const opening = this.panel !== name;
      this.panel = opening ? name : '';
      if (opening && name === 'notes') this.markNotesSeen();
      if (opening && name === 'whiteboard') this.markWhiteboardSeen();
      if (opening && name === 'poll') this.markPollSeen();
    },
    async setFeatureEnabled(feature: GatedFeatureKey, enabled: boolean, engine?: any) {
      this.enabledFeatures = { ...this.enabledFeatures, [feature]: enabled };
      if (!enabled) {
        if (this.panel === feature) this.panel = '';
        if (feature === 'stage' && this.isStageModeActive) {
          this.stageOccupantId = '';
        }
      }
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/state/${roomName}/access/defaults`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledFeatures: this.enabledFeatures }),
        }).catch((err) => console.error('Failed to update enabled features:', err));
      }
      /* v8 ignore stop */
      if (engine && this.isHost) {
        this.syncConfig(engine);
      }
    },
    applyConfigUpdate(data: {
      allowParticipantRecording?: boolean;
      lobbyEnabled?: boolean;
      lobbyForm?: 'name' | 'details';
      stagePromotionEnabled?: boolean;
      enabledFeatures?: Partial<Record<GatedFeatureKey, boolean>>;
    }) {
      if (data.allowParticipantRecording !== undefined) {
        this.allowParticipantRecording = data.allowParticipantRecording;
      }
      if (data.lobbyEnabled !== undefined) {
        this.lobbyEnabled = data.lobbyEnabled;
      }
      if (data.lobbyForm === 'name' || data.lobbyForm === 'details') {
        this.lobbyForm = data.lobbyForm;
      }
      if (data.stagePromotionEnabled !== undefined) {
        this.stagePromotionEnabled = data.stagePromotionEnabled;
      }
      if (data.enabledFeatures) {
        this.enabledFeatures = { ...this.enabledFeatures, ...data.enabledFeatures };
        if (this.panel === 'notes' && !this.canUseNotes) this.panel = '';
        if (this.panel === 'whiteboard' && !this.canUseWhiteboard) this.panel = '';
        if (this.panel === 'poll' && !this.canAccessPoll) this.panel = '';
        if (this.panel === 'chat' && !this.canUseChat) this.panel = '';
      }
    },
    resetHostForJoin(options?: { isReconnect?: boolean }) {
      if (options?.isReconnect) {
        return;
      }
      this.hostId = '';
      this.hostEmail = '';
      this.lobbyEnabled = true;
      this.pendingHostClaim = true;
      this.isFetchingConfig = false;
      this.meetingExists = false;
      this.configLoaded = false;
      this.lobbyRejected = false;
    },
    setStageMessage(message: string) {
      this.stageMessage = message;
      if (!message) return;
      window.setTimeout(() => {
        if (this.stageMessage === message) this.stageMessage = '';
      }, 4000);
    },
    resetForLeave() {
      this.isVerifiedHost = false;
      this.isVerifiedModerator = false;
      this.allowParticipantRecording = false;
      this.hostId = '';
      this.hostEmail = '';
      this.lobbyEnabled = true;
      this.panel = '';
      this.localLobbyPending = false;
      this.lobbyWaiting = [];
      this.pendingHostClaim = false;
      this.lobbyRejected = false;
      this.roomDefaults = defaultUserGrants();
      this.userGrants = {};
      this.clearPollRequests();
      this.gridBackgroundUrl = '';
      this.notesTemplate = '';
      this.hostSettingsSessionId = '';
      this.roomBgAssembly = null;
      this.notesAssembly = null;
      this.ydoc.destroy();
      this.ydoc = new Y.Doc();
      this.yjsAssembly = null;
      this.notesActivitySeq = 0;
      this.notesSeenSeq = 0;
      this.whiteboardActivitySeq = 0;
      this.whiteboardSeenSeq = 0;
      this.pollActivitySeq = 0;
      this.pollSeenSeq = 0;
      this.stagePromotionEnabled = false;
      this.stageOccupantId = '';
      this.stageLayout = defaultStageLayout();
      this.stageMessage = '';
      this.meetingExists = false;
      this.configLoaded = false;
      this.isFetchingConfig = false;
      this.eventyayMeet = false;
      this.eventyayRole = '';
      this.capabilities = [];
      this.isInvited = false;
      this.clearAllModerationTimers();
    },
    addModerationChange(change: Omit<ModerationChange, 'autoApproveTimer'>, engine?: any) {
      if (this.pendingModerationChanges.some((c) => c.id === change.id)) return;

      const timer = setTimeout(() => {
        this.approveModerationChange(change.id, engine, true);
      }, 15000);

      this.pendingModerationChanges.push({
        ...change,
        autoApproveTimer: timer,
      });
    },
    approveModerationChange(id: string, engine?: any, isAuto = false) {
      const index = this.pendingModerationChanges.findIndex((c) => c.id === id);
      if (index === -1) return;
      const item = this.pendingModerationChanges[index];
      clearTimeout(item.autoApproveTimer);
      this.pendingModerationChanges.splice(index, 1);

      if (item.type === 'whiteboard') {
        this.addWhiteboardStroke(item.payload);
        this.bumpWhiteboardActivity();
      } else {
        this.updateSharedNotes(item.payload, true);
      }

      if (!isAuto && engine) {
        engine.sendCommand('mod_change', JSON.stringify({
          action: 'approve',
          id: item.id,
        }));
      }
    },
    rejectModerationChange(id: string, engine?: any) {
      const index = this.pendingModerationChanges.findIndex((c) => c.id === id);
      if (index === -1) return;
      const item = this.pendingModerationChanges[index];
      clearTimeout(item.autoApproveTimer);
      this.pendingModerationChanges.splice(index, 1);

      if (engine) {
        engine.sendCommand('mod_change', JSON.stringify({
          action: 'reject',
          id: item.id,
        }));
      }
    },
    clearAllModerationTimers() {
      for (const c of this.pendingModerationChanges) {
        clearTimeout(c.autoApproveTimer);
      }
      this.pendingModerationChanges = [];
    },
    /* v8 ignore start */
    setVerifiedHost(verified: boolean) {
      this.isVerifiedHost = verified;
    },
    setIntegrationAccess(role: string, capabilities: string[]) {
      this.eventyayMeet = true;
      this.eventyayRole = role;
      this.capabilities = capabilities;
      this.isVerifiedHost = role === 'host';
      this.isVerifiedModerator = role === 'moderator';
      this.isInvited = true;
    },
    setAllowParticipantRecording(value: boolean) {
      this.allowParticipantRecording = value;
    },
    announceLobbyPresence(engine: any) {
      const local = useLocalStore();
      if (!this.lobbyEnabled || !local.id || this.isLobbyBlocked) return;
      engine.sendCommand('lobby', JSON.stringify({ action: 'approve', id: local.id }));
    },
    resendSessionIdentity(engine: any) {
      this.announceLobbyPresence(engine);
      if (this.eventyayMeet) return;
      if (!this.isVerifiedHost && !this.isVerifiedModerator) return;
      const local = useLocalStore();
      if (!local.id) return;
      const email = this.controlEmail();
      if (this.isVerifiedHost) {
        engine.sendCommand('host', JSON.stringify({
          hostId: local.id,
          email,
          at: Date.now(),
        }));
        this.syncConfig(engine);
      }
      broadcastHostRoomSettings(engine, this);
      for (const [userId, grants] of Object.entries(this.userGrants)) {
        engine.sendCommand('access', JSON.stringify({ userId, grants, email }));
      }
    },
    syncConfig(engine: any) {
      engine.sendCommand('config', JSON.stringify({
        allowParticipantRecording: this.allowParticipantRecording,
        lobbyEnabled: this.lobbyEnabled,
        lobbyForm: this.lobbyForm,
        stagePromotionEnabled: this.stagePromotionEnabled,
        enabledFeatures: this.enabledFeatures,
        email: this.controlEmail(),
      }));
    },
    syncOrClaimHostOnLoaded(engine: any) {
      const local = useLocalStore();
      const id = local.id;
      if (!id) return;

      if (this.isVerifiedHost && !this.eventyayMeet) {
        this.hostId = id;
        this.pendingHostClaim = false;

        if (!this.meetingExists) {
          const savedDefaults = localStorage.getItem('loungemesh:meeting_defaults');
          if (savedDefaults) {
            try {
              const parsed = JSON.parse(savedDefaults);
              this.lobbyEnabled = parsed.lobbyEnabled ?? true;
              this.stagePromotionEnabled = parsed.stagePromotionEnabled ?? true;
              this.allowParticipantRecording = parsed.allowParticipantRecording ?? false;
              if (parsed.roomDefaults) {
                this.roomDefaults = {
                  chat: parsed.roomDefaults.chat ?? true,
                  notes: parsed.roomDefaults.notes ?? false,
                  whiteboard: parsed.roomDefaults.whiteboard ?? false,
                  poll: parsed.roomDefaults.poll ?? false,
                  moderator: false,
                };
              }
            } catch (err) {
              console.error('Failed to parse meeting defaults in session:', err);
            }
          }
        }

        const auth = useAuthStore();
        const email = auth.user?.email || this.hostEmail;
        engine.sendCommand('host', JSON.stringify({ hostId: id, email }));
        engine.sendCommand('access', JSON.stringify({ defaults: this.roomDefaults }));
        engine.sendCommand('lobby', JSON.stringify({ enabled: this.lobbyEnabled }));
        engine.sendCommand('stage', JSON.stringify({ action: 'settings', stagePromotionEnabled: this.stagePromotionEnabled }));
        engine.sendCommand('config', JSON.stringify({ allowParticipantRecording: this.allowParticipantRecording }));

        if (this.applyNotesTemplateIfNeeded()) {
          broadcastYjsState(engine, this.ydoc);
        }
        broadcastHostRoomSettings(engine, this);
      } else {
        this.pendingHostClaim = false;
        const auth = useAuthStore();
        if (this.lobbyEnabled && !auth.isAuthenticated && !this.lobbyApproved[id]) {
          this.localLobbyPending = false;
        }
      }
    },
    async fetchRoomConfigAndRole(roomName: string, engine?: any) {
      this.isFetchingConfig = true;
      try {
        let initialized = false;
        try {
          const initRes = await fetch(`/api/meetings/state/${roomName}/init`);
          if (initRes.ok) {
            const data = await initRes.json();
            if (data && data.role) {
              this.isVerifiedHost = data.role.role === 'host';
              this.isVerifiedModerator = data.role.role === 'moderator';
              this.isInvited = !!data.role.isInvited;
              if (data.role.hostId) {
                this.hostId = data.role.hostId;
              }
              this.hostEmail = data.role.hostEmail || '';
              this.moderatorEmails = Array.isArray(data.role.moderatorEmails) ? data.role.moderatorEmails : [];
              this.guestEmails = Array.isArray(data.role.guestEmails) ? data.role.guestEmails : [];
              this.meetingExists = !!data.role.hostId;
              if (data.config) {
                this.allowParticipantRecording = !!data.config.allowParticipantRecording;
                this.lobbyEnabled = !!data.config.lobbyEnabled;
                this.stagePromotionEnabled = !!data.config.stagePromotionEnabled;
                this.notesTemplate = data.config.notesTemplate || '';
                this.lobbyForm = data.config.lobbyForm === 'details' ? 'details' : 'name';
              }
              if (data.whiteboard) {
                this.whiteboardStrokes = data.whiteboard.strokes || [];
              }
              if (data.notes) {
                this.sharedNotes = data.notes.notes || '';
              }
              if (data.access) {
                if (data.access.defaults) this.roomDefaults = data.access.defaults;
                if (data.access.grants) this.userGrants = data.access.grants;
                if (data.access.enabledFeatures) {
                  this.enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...data.access.enabledFeatures };
                }
              }
              if (data.poll && data.poll.poll) {
                this.activePoll = data.poll.poll;
                this.syncMyPollVoteFromPoll();
              }
              if (data.background) {
                this.gridBackgroundUrl = data.background.gridBackgroundUrl || '';
              }
              initialized = true;
            }
          }
        } catch {
          /* Fallback to parallel individual endpoints */
        }

        if (!initialized) {
          const [roleRes, configRes, wbRes, notesRes, accessRes, pollRes, bgRes] = await Promise.all([
            fetch(`/api/meetings/role/${roomName}`),
            fetch(`/api/meetings/config/${roomName}`),
            fetch(`/api/meetings/state/${roomName}/whiteboard`),
            fetch(`/api/meetings/state/${roomName}/notes`),
            fetch(`/api/meetings/state/${roomName}/access`),
            fetch(`/api/meetings/state/${roomName}/poll`),
            fetch(`/api/meetings/state/${roomName}/background`),
          ]);

          if (roleRes.ok) {
            const data = await roleRes.json();
            this.isVerifiedHost = data.role === 'host';
            this.isVerifiedModerator = data.role === 'moderator';
            this.isInvited = !!data.isInvited;
            if (data.hostId) {
              this.hostId = data.hostId;
            }
            this.hostEmail = data.hostEmail || '';
            this.moderatorEmails = Array.isArray(data.moderatorEmails) ? data.moderatorEmails : [];
            this.guestEmails = Array.isArray(data.guestEmails) ? data.guestEmails : [];
          }
          if (configRes.ok) {
            this.meetingExists = true;
            const config = await configRes.json();
            this.allowParticipantRecording = !!config.allowParticipantRecording;
            this.lobbyEnabled = !!config.lobbyEnabled;
            this.stagePromotionEnabled = !!config.stagePromotionEnabled;
            this.notesTemplate = config.notesTemplate || '';
            this.lobbyForm = config.lobbyForm === 'details' ? 'details' : 'name';
          } else {
            this.meetingExists = false;
          }
          if (wbRes.ok) {
            const wbData = await wbRes.json();
            this.whiteboardStrokes = wbData.strokes || [];
          }
          if (notesRes.ok) {
            const notesData = await notesRes.json();
            this.sharedNotes = notesData.notes || '';
          }
          if (accessRes.ok) {
            const accessData = await accessRes.json();
            if (accessData.defaults) this.roomDefaults = accessData.defaults;
            if (accessData.grants) this.userGrants = accessData.grants;
            if (accessData.enabledFeatures) {
              this.enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...accessData.enabledFeatures };
            }
          }
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.poll) {
              this.activePoll = pollData.poll;
              this.syncMyPollVoteFromPoll();
            }
          }
          if (bgRes.ok) {
            const bgData = await bgRes.json();
            this.gridBackgroundUrl = bgData.gridBackgroundUrl || '';
          }
        }
      } catch (err) {
        console.error('Failed to fetch room config/role:', err);
      } finally {
        this.isFetchingConfig = false;
        this.configLoaded = true;
        this.seedNotesDocumentIfEmpty();
        const conferenceStore = useConferenceStore();
        if (engine && conferenceStore.isJoined) {
          this.syncOrClaimHostOnLoaded(engine);
          this.resendSessionIdentity(engine);
          this.setupYjsSync(engine);
          if (Object.keys(conferenceStore.users).length > 0) {
            engine.sendCommand('notes', JSON.stringify({ action: 'yjs_request' }));
          }
        }
      }
    },
    async updateRoomConfig(
      roomName: string,
      updates: {
        allowParticipantRecording?: boolean;
        lobbyEnabled?: boolean;
        lobbyForm?: 'name' | 'details';
        stagePromotionEnabled?: boolean;
        notesTemplate?: string;
      },
      engine: any
    ) {
      try {
        const response = await fetch(`/api/meetings/config/${roomName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (response.ok) {
          const config = await response.json();
          this.allowParticipantRecording = !!config.allowParticipantRecording;
          this.lobbyEnabled = !!config.lobbyEnabled;
          this.stagePromotionEnabled = !!config.stagePromotionEnabled;
          this.notesTemplate = config.notesTemplate || '';
          this.lobbyForm = config.lobbyForm === 'details' ? 'details' : this.lobbyForm;
          this.syncConfig(engine);
        }
      } catch (err) {
        console.error('Failed to update room config:', err);
      }
    },
    setupYjsSync(engine: any) {
      if (this._yjsListener) {
        this.ydoc.off('update', this._yjsListener);
      }
      this._yjsListener = (update: Uint8Array, origin: any) => {
        if (origin === 'remote') return;
        if (!this.canUseNotes) return;
        const base64 = btoa(String.fromCharCode(...update));
        engine.sendCommand('notes', JSON.stringify({ action: 'yjs_update', update: base64 }));
      };
      this.ydoc.on('update', this._yjsListener);
    },
    applyYjsCommand(command: any) {
      if (command.action === 'yjs_begin') {
        this.yjsAssembly = { total: command.total, parts: {} };
        return;
      }
      if (command.action === 'yjs_chunk') {
        if (!this.yjsAssembly) return;
        this.yjsAssembly.parts[command.index] = command.data;
        if (Object.keys(this.yjsAssembly.parts).length !== this.yjsAssembly.total) return;
        const encoded = Array.from({ length: this.yjsAssembly.total }, (_, index) => {
          return this.yjsAssembly?.parts[index] ?? '';
        }).join('');
        this.yjsAssembly = null;
        const binary = new Uint8Array(
          atob(encoded).split('').map((c) => c.charCodeAt(0)),
        );
        Y.applyUpdate(this.ydoc, binary, 'remote');
        return;
      }
      if (command.action === 'yjs_update') {
        const binary = new Uint8Array(
          atob(command.update).split('').map((c) => c.charCodeAt(0)),
        );
        Y.applyUpdate(this.ydoc, binary, 'remote');
      }
    },
    /* v8 ignore stop */
  },
});
