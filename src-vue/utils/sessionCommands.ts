import { canApplyChatEdit, findChatMessage } from '@/utils/chatMessage';
import * as Y from 'yjs';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import type { WhiteboardCommand } from '@/utils/whiteboardSync';
import { applyParticipantHandRaised, parseHandRaised } from '@/utils/sessionHandRaise';
import { pollActivityChanged } from '@/utils/sessionPoll';
import { playUiSound } from '@/utils/uiSounds';
import {
  applyStageDemote,
  applyStageLayout,
  applyStagePromote,
  applyStageInvite,
  type StageCommand,
} from '@/utils/sessionStage';

export type CommandPayload = { value: string };

export function buildHelloCommand(id: string): string {
  const local = useLocalStore();
  const conference = useConferenceStore();
  const auth = useAuthStore();
  return JSON.stringify({
    id,
    userKey: local.userKey,
    pos: local.pos,
    name: conference.displayName,
    email: auth.user?.email || undefined,
  });
}

const processedStageCommandIds = new Set<string>();

function parse<T>(payload: CommandPayload): T | null {
  try {
    return JSON.parse(payload.value) as T;
  } catch {
    return null;
  }
}

/* v8 ignore start */
function sameEmail(left?: string, right?: string): boolean {
  const a = left?.trim().toLowerCase() || '';
  const b = right?.trim().toLowerCase() || '';
  return !!a && a === b;
}

/** Host or moderator room controls. A matching email still counts while hostId is the database id. */
export function canApplyRoomControl(
  senderId: string | undefined,
  features: ReturnType<typeof useSessionFeaturesStore>,
  conference: ReturnType<typeof useConferenceStore>,
  email?: string,
): boolean {
  if (!senderId) return true;
  if (features.hostId && senderId === features.hostId) return true;
  if (features.userGrants[senderId]?.moderator) return true;
  if (conference.users[senderId]?.properties?.role === 'moderator') return true;
  if (sameEmail(email, features.hostEmail)) return true;
  return features.moderatorEmails.some((item) => sameEmail(email, item));
}

/** Room-wide settings stay with the meeting host. */
export function canApplyHostSettings(
  senderId: string | undefined,
  features: ReturnType<typeof useSessionFeaturesStore>,
  email?: string,
): boolean {
  if (!senderId) return true;
  if (features.hostId && senderId === features.hostId) return true;
  return sameEmail(email, features.hostEmail);
}

/** Host can moderate anyone. A moderator cannot mute or remove the host or another moderator. */
function canModerateParticipant(
  senderId: string | undefined,
  targetId: string,
  features: ReturnType<typeof useSessionFeaturesStore>,
  conference: ReturnType<typeof useConferenceStore>,
): boolean {
  if (!senderId) return true;
  if (!canApplyRoomControl(senderId, features, conference)) return false;
  if (canApplyHostSettings(senderId, features)) return true;
  if (targetId && targetId === features.hostId) return false;
  if (targetId && features.userGrants[targetId]?.moderator) return false;
  if (targetId && conference.users[targetId]?.properties?.role === 'moderator') return false;
  return true;
}

function isSenderModeratorOrHost(senderId: string | undefined, features: ReturnType<typeof useSessionFeaturesStore>): boolean {
  if (!senderId) return false;
  if (features.hostId === senderId) return true;
  if (features.userGrants[senderId]?.moderator) return true;
  return false;
}
/* v8 ignore stop */

/** Apply a conference command from another participant. */
export function handleSessionCommand(name: string, payload: CommandPayload, senderId?: string): void {
  const features = useSessionFeaturesStore();
  const conference = useConferenceStore();
  const local = useLocalStore();

  switch (name) {
    case 'hello': {
      const data = parse<{ id?: string; userKey?: string; pos?: { x: number; y: number }; name?: string; email?: string }>(payload);
      if (!data?.id || data.id === local.id || (senderId && data.id !== senderId)) break;
      if (data.userKey) {
        conference.dedupeUserByKey(data.id, data.userKey);
      }
      if (!conference.users[data.id]) {
        conference.addUser(data.id, { _displayName: data.name }, data.userKey);
      } else if (data.userKey) {
        conference.users[data.id].userKey = data.userKey;
      }
      if (data.pos) {
        conference.updateUserPosition(data.id, data.pos);
      }
      if (data.name) {
        conference.updateUserDisplayName(data.id, data.name);
      }
      features.admitParticipantEmail(data.id, data.email);
      conference.recordUserHeartbeat(data.id);
      break;
    }
    case 'hello_req': {
      const data = parse<{ from?: string }>(payload);
      if (!data?.from || data.from === local.id) break;
      const engine = getMediaEngineInstance();
      if (engine && local.id) {
        engine.sendCommand('hello', buildHelloCommand(local.id));
      }
      break;
    }
    case 'pos': {
      const pos = parse<{ id?: string; x?: number; y?: number }>(payload);
      if (pos?.id != null && pos.x != null && pos.y != null) {
        conference.updateUserPosition(pos.id, { x: pos.x, y: pos.y });
      }
      break;
    }
    case 'name': {
      const data = parse<{ id?: string; name?: string }>(payload);
      if (data?.id && data.name?.trim()) {
        conference.updateUserDisplayName(data.id, data.name.trim());
      }
      break;
    }
    case 'host': {
      const data = parse<{ hostId?: string; email?: string }>(payload);
      if (!data?.hostId || features.pendingHostClaim || features.isVerifiedHost) break;
      const email = (data.email || '').trim().toLowerCase();
      const expected = features.hostEmail.trim().toLowerCase();
      if (!email || !expected || email !== expected) break;
      features.setHost(data.hostId);
      break;
    }
    case 'lobby': {
      const data = parse<{
        action?: string;
        id?: string;
        name?: string;
        enabled?: boolean;
        email?: string;
        reason?: string;
      }>(payload);
      if (!data) break;
      if (data.enabled != null && canApplyHostSettings(senderId, features, data.email)) {
        features.lobbyEnabled = data.enabled;
      }
      if (data.action === 'wait' && data.id && data.name) {
        features.addLobbyWaiter({
          id: data.id,
          name: data.name,
          email: data.email,
          reason: data.reason,
        });
        if (features.isHost || features.isModerator) {
          playUiSound('lobbyKnock');
        }
      }
      if (data.action === 'cancel' && data.id) {
        if (senderId && senderId !== data.id) break;
        features.rejectLobby(data.id);
      }
      if (data.action === 'approve' && data.id) {
        if (senderId && !canApplyRoomControl(senderId, features, conference, data.email)) break;
        features.approveLobby(data.id);
        if (data.id === local.id) features.localLobbyPending = false;
      }
      if (data.action === 'reject' && data.id) {
        if (senderId && !canApplyRoomControl(senderId, features, conference, data.email)) break;
        features.rejectLobby(data.id);
        if (data.id === local.id) {
          features.localLobbyPending = false;
          features.lobbyRejected = true;
        }
      }
      break;
    }
    case 'react': {
      const data = parse<{ id?: string; emoji?: string }>(payload);
      if (data?.id && data.emoji) features.setReaction(data.id, data.emoji);
      break;
    }
    case 'hand': {
      const data = parse<{ id?: string; raised?: boolean }>(payload);
      if (!data?.id || typeof data.raised !== 'boolean') break;
      applyParticipantHandRaised(data.id, data.raised, { notify: true });
      break;
    }
    case 'poll': {
      if (features.enabledFeatures.poll === false) break;
      if (payload.value === 'null') {
        /* v8 ignore next 4 */
        if (senderId && !isSenderModeratorOrHost(senderId, features)) {
          console.warn('Non-moderator tried to end the poll:', senderId);
          break;
        }
        features.applyPoll(null);
        break;
      }
      const data = parse<import('@/stores/sessionFeaturesStore').ActivePoll>(payload);
      if (!data) break;
      if (features.activePoll?.id !== data.id) {
        /* v8 ignore next 4 */
        if (senderId && !isSenderModeratorOrHost(senderId, features)) {
          console.warn('Non-moderator tried to start a new poll:', senderId);
          break;
        }
      }
      const prev = features.activePoll;
      const panelClosed = features.panel !== 'poll';
      features.applyPoll(data);
      if (pollActivityChanged(prev, features.activePoll)) {
        features.bumpPollActivity();
        if (panelClosed) playUiSound('chatMessage');
      }
      features.pollRequestNotice = '';
      break;
    }
    case 'poll_req': {
      if (features.enabledFeatures.poll === false) break;
      const data = parse<{
        action?: 'create' | 'approve' | 'reject' | 'cancel';
        request?: import('@/stores/sessionFeaturesStore').PollRequest;
        requestId?: string;
      }>(payload);
      if (!data?.action) break;
      if (data.action === 'create' && data.request?.id) {
        features.addPollRequest(data.request);
        if (features.isHost || features.isModerator) {
          features.bumpPollActivity();
          if (features.panel !== 'poll') playUiSound('chatMessage');
        }
      } else if (data.action === 'approve' && data.requestId) {
        features.removePollRequest(data.requestId);
      } else if (data.action === 'reject' && data.requestId) {
        if (features.myPendingPollRequestId === data.requestId) {
          features.pollRequestNotice = 'Your poll request was declined by a moderator.';
        }
        features.removePollRequest(data.requestId);
      } else if (data.action === 'cancel' && data.requestId) {
        features.removePollRequest(data.requestId);
      }
      break;
    }
    case 'notes': {
      if (features.enabledFeatures.notes === false) break;
      const data = parse<any>(payload);
      if (!data) break;
      if ('action' in data && data.action) {
        if (data.action === 'yjs_request') {
          const state = Y.encodeStateAsUpdate(features.ydoc);
          const base64 = btoa(String.fromCharCode(...state));
          const engine = getMediaEngineInstance();
          const NOTES_CHUNK_SIZE = 8000;
          const total = Math.ceil(base64.length / NOTES_CHUNK_SIZE);
          engine.sendCommand('notes', JSON.stringify({ action: 'yjs_begin', total }));
          for (let i = 0, offset = 0; offset < base64.length; i += 1, offset += NOTES_CHUNK_SIZE) {
            engine.sendCommand('notes', JSON.stringify({
              action: 'yjs_chunk',
              index: i,
              data: base64.slice(offset, offset + NOTES_CHUNK_SIZE),
            }));
          }
        } else if (
          data.action === 'yjs_begin' ||
          data.action === 'yjs_chunk' ||
          data.action === 'yjs_update'
        ) {
          features.applyYjsCommand(data);
        } else {
          features.applyNotesCommand(data);
        }
        break;
      }
      if (data.text != null) {
        features.sharedNotes = data.text;
        features.bumpNotesActivity();
      }
      break;
    }
    case 'room': {
      const data = parse<
        (
          | import('@/utils/roomBackgroundSync').RoomBackgroundCommand
          | { gridBackgroundUrl?: string | null }
        ) & { email?: string }
      >(payload);
      if (!data) break;
      if (senderId && !canApplyRoomControl(senderId, features, conference, data.email)) break;
      if ('action' in data && data.action) {
        features.applyRoomBackgroundCommand(data);
        break;
      }
      if (data.gridBackgroundUrl === null || data.gridBackgroundUrl === '') {
        features.gridBackgroundUrl = '';
      } else if (typeof data.gridBackgroundUrl === 'string') {
        features.gridBackgroundUrl = data.gridBackgroundUrl;
      }
      break;
    }
    case 'access': {
      const data = parse<
        import('@/utils/sessionAccess').AccessCommandPayload & {
          notes?: boolean;
          whiteboard?: boolean;
          email?: string;
        }
      >(payload);
      if (!data) break;
      if (!canApplyRoomControl(senderId, features, conference, data.email)) break;
      if (senderId && !canApplyHostSettings(senderId, features, data.email)) {
        const grants = data.grants ? { ...data.grants } : undefined;
        if (grants) delete grants.moderator;
        features.applyAccessUpdate({ userId: data.userId, grants });
        break;
      }
      features.applyAccessUpdate(data);
      break;
    }
    case 'config': {
      const data = parse<{
        allowParticipantRecording?: boolean;
        lobbyEnabled?: boolean;
        lobbyForm?: 'name' | 'details';
        stagePromotionEnabled?: boolean;
        enabledFeatures?: Partial<Record<import('@/utils/featureAccess').GatedFeatureKey, boolean>>;
        email?: string;
      }>(payload);
      if (data) {
        if (!canApplyHostSettings(senderId, features, data.email)) break;
        features.applyConfigUpdate(data);
      }
      break;
    }
    case 'chat': {
      if (features.enabledFeatures.chat === false) break;
      const data = parse<{
        action?: string;
        text?: string;
        nr?: number;
        messageId?: string;
        editedAt?: number;
        editorId?: string;
        senderId?: string;
      }>(payload);
      if (data?.action === 'post') {
        if (typeof data.text === 'string' && senderId) {
          conference.ingestChatMessage(
            senderId,
            data.text,
            typeof data.nr === 'number' ? data.nr : -1,
          );
        }
        break;
      }
      if (
        data?.action === 'edit' &&
        data.messageId &&
        data.text != null &&
        data.editedAt != null &&
        data.editorId &&
        (!senderId || senderId === data.editorId) &&
        canApplyChatEdit(conference.messages, data.messageId, data.editorId, data.nr)
      ) {
        conference.editChatMessage(
          data.messageId,
          data.text,
          data.editedAt,
          data.nr,
          data.editorId,
        );
      }
      if (data?.action === 'delete') {
        const caller = senderId || data.senderId;
        const isMod = isSenderModeratorOrHost(caller, features);
        const msg = findChatMessage(conference.messages, {
          messageId: data.messageId || '',
          nr: data.nr,
          authorId: caller,
        });
        const isOwner = Boolean(caller && msg && msg.id === caller);
        if (isMod || isOwner) {
          conference.removeChatMessage(data.messageId || '', data.nr);
        }
      }
      break;
    }
    case 'mod_change': {
      const data = parse<{
        action?: 'propose' | 'approve' | 'reject';
        id?: string;
        type?: 'whiteboard' | 'notes';
        authorId?: string;
        authorName?: string;
        payload?: any;
        timestamp?: number;
      }>(payload);
      if (!data?.action || !data.id) break;
      if (data.type === 'whiteboard' && features.enabledFeatures.whiteboard === false) break;
      if (data.type === 'notes' && features.enabledFeatures.notes === false) break;
      if (data.action === 'propose' && data.type && data.payload) {
        features.addModerationChange({
          id: data.id,
          type: data.type,
          authorId: data.authorId || '',
          authorName: data.authorName || '',
          payload: data.payload,
          timestamp: data.timestamp || 0,
        }, getMediaEngineInstance());
      } else if (data.action === 'approve') {
        if (senderId && !isSenderModeratorOrHost(senderId, features)) break;
        features.approveModerationChange(data.id, undefined, true);
      } else {
        if (senderId && !isSenderModeratorOrHost(senderId, features)) break;
        features.rejectModerationChange(data.id);
      }
      break;
    }
    case 'mod': {
      const data = parse<{ action?: string; id?: string }>(payload);
      if (data?.action === 'kick' && data.id === local.id) {
        if (!canModerateParticipant(senderId, data.id, features, conference)) break;
        conference.leaveConference();
        window.location.href = '/kicked';
      }
      if (data?.action === 'mute' && data.id) {
        if (!canModerateParticipant(senderId, data.id, features, conference)) break;
        if (data.id === local.id && !local.mute) {
          void local.toggleMute();
        } else if (conference.users[data.id]) {
          conference.patchUser(data.id, { mute: true });
          const engine = getMediaEngineInstance();
          engine.setParticipantVolume(data.id, 0);
          engine.disconnectParticipantAudio?.(data.id);
        }
      }
      break;
    }
    case 'wb': {
      if (features.enabledFeatures.whiteboard === false) break;
      const data = parse<WhiteboardCommand>(payload);
      if (!data) break;
      if (data.action === 'clear') {
        /* v8 ignore next 4 */
        if (senderId && !isSenderModeratorOrHost(senderId, features)) {
          console.warn('Non-moderator tried to clear the whiteboard:', senderId);
          break;
        }
        features.clearWhiteboard();
        features.bumpWhiteboardActivity();
      }
      if (data.action === 'stroke') {
        features.addWhiteboardStroke(data.stroke);
        features.bumpWhiteboardActivity();
      }
      break;
    }
    case 'stage': {
      if (features.enabledFeatures.stage === false) break;
      const data = parse<StageCommand & { _cmdId?: string }>(payload);
      if (!data?.action) break;
      if (data._cmdId) {
        if (processedStageCommandIds.has(data._cmdId)) {
          break;
        }
        processedStageCommandIds.add(data._cmdId);
        if (processedStageCommandIds.size > 100) {
          const first = processedStageCommandIds.values().next().value;
          if (first !== undefined) {
            processedStageCommandIds.delete(first);
          }
        }
      }
      if (data.action === 'invite' && data.id) {
        if (senderId && !canApplyHostSettings(senderId, features)) break;
        const engine = getMediaEngineInstance();
        applyStageInvite(engine, data.id);
      }
      if (data.action === 'promote' && data.id) {
        if (senderId && !canApplyHostSettings(senderId, features)) break;
        applyStagePromote(data.id);
      }
      if (data.action === 'demote' && data.id) {
        const self = !!senderId && senderId === data.id;
        if (senderId && !self && !canApplyRoomControl(senderId, features, conference)) break;
        applyStageDemote(data.id);
      }
      if (data.action === 'layout' && data.layout) {
        if (local.id !== features.stageOccupantId) {
          applyStageLayout(data.layout);
        }
      }
      if (data.action === 'settings' && data.stagePromotionEnabled != null) {
        if (senderId && !canApplyHostSettings(senderId, features)) break;
        features.stagePromotionEnabled = data.stagePromotionEnabled;
      }
      break;
    }
    default:
      break;
  }
}
