import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import type { WhiteboardCommand } from '@/utils/whiteboardSync';

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
    case 'poll': {
      features.applyPoll(parse<import('@/stores/sessionFeaturesStore').ActivePoll>(payload));
      break;
    }
    case 'notes': {
      const data = parse<{ text?: string }>(payload);
      if (data?.text != null) features.sharedNotes = data.text;
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
      }>(payload);
      if (
        data?.action === 'edit' &&
        data.messageId &&
        data.text != null &&
        data.editedAt != null
      ) {
        conference.editChatMessage(data.messageId, data.text, data.editedAt);
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
          conference.users[data.id].mute = true;
        }
      }
      break;
    }
    case 'wb': {
      const data = parse<WhiteboardCommand>(payload);
      if (!data) break;
      if (data.action === 'clear') features.clearWhiteboard();
      if (data.action === 'stroke') features.addWhiteboardStroke(data.stroke);
      break;
    }
    default:
      break;
  }
}
