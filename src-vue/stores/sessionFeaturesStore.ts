import { defineStore } from 'pinia';
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

import type { NotesCommand } from '@/utils/notesSync';
import { decodeNotesFromWire, broadcastSharedNotes } from '@/utils/notesSync';
import type { RoomBackgroundCommand } from '@/utils/roomBackgroundSync';
import { broadcastHostRoomSettings } from '@/utils/hostRoomSettings';

export type LobbyEntry = { id: string; name: string; email?: string; reason?: string };
export type PollOption = { id: string; label: string; votes: number; voters?: string[] };
export type ActivePoll = {
  id: string;
  question: string;
  options: PollOption[];
  open: boolean;
};
export type UserReaction = { emoji: string; at: number };
export type { WhiteboardStroke };

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
    allowParticipantRecording: false,
    hostId: '',
    lobbyEnabled: false,
    lobbyApproved: {} as Record<string, boolean>,
    lobbyWaiting: [] as LobbyEntry[],
    localLobbyPending: false,
    lobbyRejected: false,
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
    whiteboardSnapshots: [] as Array<WhiteboardStroke[]>,
    roomDefaults: defaultUserGrants(),
    userGrants: {} as Record<string, Partial<UserGrants>>,
    panel: '' as '' | 'reactions' | 'poll' | 'moderator' | 'notes' | 'whiteboard' | 'chat',
    pendingHostClaim: false,
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
      if (this.isVerifiedHost) return true;
      const local = useLocalStore();
      if (!local.id) return false;
      if (this.isFetchingConfig) {
        return false;
      }
      if (this.meetingExists) {
        return this.hostId === local.id;
      }
      if (!this.hostId) return true;
      return this.hostId === local.id;
    },
    isModerator(): boolean {
      if (this.isVerifiedHost || this.isVerifiedModerator) return true;
      const local = useLocalStore();
      if (!local.id) return false;
      if (this.hostId === local.id) return true;
      return !!this.userGrants[local.id]?.moderator;
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
    canPromoteToStage(): boolean {
      return this.isHost && this.stagePromotionEnabled;
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
      return this.isHost || this.isModerator;
    },
    isLobbyBlocked(): boolean {
      if (!this.lobbyEnabled) return false;
      if (this.isHost || this.isModerator) return false;
      const auth = useAuthStore();
      if (auth.isAuthenticated) return false;
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
    setGridBackgroundUrl(url: string) {
      this.gridBackgroundUrl = url;
      /* v8 ignore start */
      const roomName = window.location.pathname.split('/').pop();
      if (roomName) {
        fetch(`/api/meetings/state/${roomName}/background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gridBackgroundUrl: url }),
        }).catch((err) => console.error('Failed to save background:', err));
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
              if (data && data.backgroundUrl !== undefined) {
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
      if (!this.isHost || !this.notesTemplate.trim() || this.sharedNotes.trim()) return false;
      this.updateSharedNotes(this.notesTemplate, true);
      return true;
    },
    /** Replace shared notes with the host template (host only). */
    resetSharedNotesToTemplate(): boolean {
      if (!this.isHost || !this.notesTemplate.trim()) return false;
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
      const current = this.grantsForUser(userId);
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
      if (name === 'notes' && !this.canUseNotes && !this.isHost && !this.isModerator) return;
      if (name === 'whiteboard' && !this.canUseWhiteboard && !this.isHost && !this.isModerator) return;
      if (name === 'poll' && !this.canUsePoll && !this.isHost && !this.isModerator) return;
      if (name === 'moderator' && !this.isHost && !this.isModerator) return;
      const opening = this.panel !== name;
      this.panel = opening ? name : '';
      if (opening && name === 'notes') this.markNotesSeen();
      if (opening && name === 'whiteboard') this.markWhiteboardSeen();
      if (opening && name === 'poll') this.markPollSeen();
    },
    resetHostForJoin() {
      this.hostId = '';
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
      this.panel = '';
      this.localLobbyPending = false;
      this.lobbyWaiting = [];
      this.pendingHostClaim = false;
      this.lobbyRejected = false;
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
      this.stagePromotionEnabled = false;
      this.stageOccupantId = '';
      this.stageLayout = defaultStageLayout();
      this.stageMessage = '';
      this.meetingExists = false;
      this.configLoaded = false;
      this.isFetchingConfig = false;
    },
    /* v8 ignore start */
    setVerifiedHost(verified: boolean) {
      this.isVerifiedHost = verified;
    },
    setAllowParticipantRecording(value: boolean) {
      this.allowParticipantRecording = value;
    },
    syncConfig(engine: any) {
      engine.sendCommand('config', JSON.stringify({
        allowParticipantRecording: this.allowParticipantRecording,
        lobbyEnabled: this.lobbyEnabled,
        stagePromotionEnabled: this.stagePromotionEnabled,
      }));
    },
    syncOrClaimHostOnLoaded(engine: any) {
      const local = useLocalStore();
      const id = local.id;
      if (!id) return;

      const isHost = this.isVerifiedHost || (!this.meetingExists && !this.hostId);

      if (isHost) {
        this.hostId = id;
        this.pendingHostClaim = false;

        if (!this.meetingExists) {
          const savedDefaults = localStorage.getItem('loungemesh:meeting_defaults');
          if (savedDefaults) {
            try {
              const parsed = JSON.parse(savedDefaults);
              this.lobbyEnabled = parsed.lobbyEnabled ?? false;
              this.stagePromotionEnabled = parsed.stagePromotionEnabled ?? true;
              this.allowParticipantRecording = parsed.allowParticipantRecording ?? false;
              if (parsed.roomDefaults) {
                this.roomDefaults = {
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

        engine.sendCommand('host', JSON.stringify({ hostId: id }));
        engine.sendCommand('access', JSON.stringify({ defaults: this.roomDefaults }));
        engine.sendCommand('lobby', JSON.stringify({ enabled: this.lobbyEnabled }));
        engine.sendCommand('stage', JSON.stringify({ action: 'settings', stagePromotionEnabled: this.stagePromotionEnabled }));
        engine.sendCommand('config', JSON.stringify({ allowParticipantRecording: this.allowParticipantRecording }));

        if (this.applyNotesTemplateIfNeeded()) {
          broadcastSharedNotes(engine, this.sharedNotes);
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
        const roleRes = await fetch(`/api/meetings/role/${roomName}`);
        if (roleRes.ok) {
          const data = await roleRes.json();
          this.isVerifiedHost = data.role === 'host';
          this.isVerifiedModerator = data.role === 'moderator';
          if (data.hostId) {
            this.hostId = data.hostId;
          }
        }
        const configRes = await fetch(`/api/meetings/config/${roomName}`);
        if (configRes.ok) {
          this.meetingExists = true;
          const config = await configRes.json();
          this.allowParticipantRecording = !!config.allowParticipantRecording;
          this.lobbyEnabled = !!config.lobbyEnabled;
          this.stagePromotionEnabled = !!config.stagePromotionEnabled;
          this.notesTemplate = config.notesTemplate || '';
        } else {
          this.meetingExists = false;
        }
        const wbRes = await fetch(`/api/meetings/state/${roomName}/whiteboard`);
        if (wbRes.ok) {
          const wbData = await wbRes.json();
          this.whiteboardStrokes = wbData.strokes || [];
        }
        const notesRes = await fetch(`/api/meetings/state/${roomName}/notes`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          this.sharedNotes = notesData.notes || '';
        }
        const accessRes = await fetch(`/api/meetings/state/${roomName}/access`);
        if (accessRes.ok) {
          const accessData = await accessRes.json();
          if (accessData.defaults) this.roomDefaults = accessData.defaults;
          if (accessData.grants) this.userGrants = accessData.grants;
        }
        const pollRes = await fetch(`/api/meetings/state/${roomName}/poll`);
        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.poll) {
            this.activePoll = pollData.poll;
            this.syncMyPollVoteFromPoll();
          }
        }
        const bgRes = await fetch(`/api/meetings/state/${roomName}/background`);
        if (bgRes.ok) {
          const bgData = await bgRes.json();
          this.gridBackgroundUrl = bgData.gridBackgroundUrl || '';
        }
      } catch (err) {
        console.error('Failed to fetch room config/role:', err);
      } finally {
        this.isFetchingConfig = false;
        this.configLoaded = true;
        const conferenceStore = useConferenceStore();
        if (engine && conferenceStore.isJoined) {
          this.syncOrClaimHostOnLoaded(engine);
        }
      }
    },
    async updateRoomConfig(
      roomName: string,
      updates: { allowParticipantRecording?: boolean; lobbyEnabled?: boolean; stagePromotionEnabled?: boolean; notesTemplate?: string },
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
          this.syncConfig(engine);
        }
      } catch (err) {
        console.error('Failed to update room config:', err);
      }
    },
    /* v8 ignore stop */
  },
});
