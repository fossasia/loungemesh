import { canApplyChatEdit } from '@/utils/chatMessage';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import type { WhiteboardCommand } from '@/utils/whiteboardSync';
import { applyParticipantHandRaised, parseHandRaised } from '@/utils/sessionHandRaise';
import { pollActivityChanged } from '@/utils/sessionPoll';
import { playUiSound } from '@/utils/uiSounds';
import {
  applyStageDemote,
  applyStageLayout,
  applyStagePromote,
  type StageCommand,
} from '@/utils/sessionStage';

type CommandPayload = { value: string };

function parse<T>(payload: CommandPayload): T | null {
  try {
    return JSON.parse(payload.value) as T;
  } catch {
    return null;
  }
}

/** Apply a conference command from another participant. */
export function handleSessionCommand(name: string, payload: CommandPayload): void {
  const features = useSessionFeaturesStore();
  const conference = useConferenceStore();
  const local = useLocalStore();

  switch (name) {
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
      const data = parse<{ hostId?: string }>(payload);
      if (data?.hostId && !features.hostId && !features.pendingHostClaim) {
        features.setHost(data.hostId);
      }
      break;
    }
    case 'lobby': {
      const data = parse<{
        action?: string;
        id?: string;
        name?: string;
        enabled?: boolean;
      }>(payload);
      if (!data) break;
      if (data.enabled != null) features.lobbyEnabled = data.enabled;
      if (data.action === 'wait' && data.id && data.name) {
        features.addLobbyWaiter({ id: data.id, name: data.name });
      }
      if (data.action === 'approve' && data.id) {
        features.approveLobby(data.id);
        if (data.id === local.id) features.localLobbyPending = false;
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
      if (payload.value === 'null') {
        features.applyPoll(null);
        break;
      }
      const data = parse<import('@/stores/sessionFeaturesStore').ActivePoll>(payload);
      if (!data) break;
      const prev = features.activePoll;
      const panelClosed = features.panel !== 'poll';
      features.applyPoll(data);
      if (pollActivityChanged(prev, features.activePoll)) {
        features.bumpPollActivity();
        if (panelClosed) playUiSound('chatMessage');
      }
      break;
    }
    case 'notes': {
      const data = parse<
        import('@/utils/notesSync').NotesCommand & { text?: string }
      >(payload);
      if (!data) break;
      if ('action' in data && data.action) {
        features.applyNotesCommand(data);
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
        import('@/utils/roomBackgroundSync').RoomBackgroundCommand & {
          gridBackgroundUrl?: string | null;
        }
      >(payload);
      if (!data) break;
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
        }
      >(payload);
      if (!data) break;
      features.applyAccessUpdate(data);
      break;
    }
    case 'chat': {
      const data = parse<{
        action?: string;
        messageId?: string;
        text?: string;
        editedAt?: number;
        editorId?: string;
        nr?: number;
      }>(payload);
      if (
        data?.action === 'edit' &&
        data.messageId &&
        data.text != null &&
        data.editedAt != null &&
        data.editorId &&
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
      break;
    }
    case 'mod': {
      const data = parse<{ action?: string; id?: string }>(payload);
      if (data?.action === 'kick' && data.id === local.id) {
        conference.leaveConference();
      }
      if (data?.action === 'mute' && data.id) {
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
      const data = parse<WhiteboardCommand>(payload);
      if (!data) break;
      if (data.action === 'clear') {
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
      const data = parse<StageCommand>(payload);
      if (!data?.action) break;
      if (data.action === 'promote' && data.id) {
        applyStagePromote(data.id);
      }
      if (data.action === 'demote' && data.id) {
        applyStageDemote(data.id);
      }
      if (data.action === 'layout' && data.layout) {
        applyStageLayout(data.layout);
      }
      if (data.action === 'settings' && data.stagePromotionEnabled != null) {
        features.stagePromotionEnabled = data.stagePromotionEnabled;
      }
      break;
    }
    default:
      break;
  }
}
