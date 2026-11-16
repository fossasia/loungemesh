/**
 * Sticky room state stays in XMPP presence so late joiners see it.
 * Everything else (notes, whiteboard, chat, reactions, polls, …) is a one-shot
 * JSON message. Presence only keeps the latest value per name and is re-sent
 * on every avatar move, so large commands there disconnect Prosody.
 */
export const STICKY_PRESENCE_COMMANDS = ['pos', 'name', 'host', 'access', 'config', 'hand'] as const;

/** Names that must be stripped from presence if an older client left them there. */
export const LIVE_PRESENCE_KEYS_TO_CLEAR = [
  'notes',
  'wb',
  'chat',
  'react',
  'poll',
  'poll_req',
  'mod',
  'mod_change',
  'stage',
  'hello',
  'hello_req',
  'room',
  'lobby',
] as const;

export const LIVE_COMMAND_TYPE = 'lm-cmd';

/** Gap between live messages so a notes/whiteboard burst cannot trip Prosody rate limits. */
export const LIVE_COMMAND_GAP_MS = 25;

export function isStickyPresenceCommand(name: string): boolean {
  return (STICKY_PRESENCE_COMMANDS as readonly string[]).includes(name);
}

export function liveCommandPayload(
  name: string,
  value: string,
): { type: typeof LIVE_COMMAND_TYPE; name: string; value: string } {
  return { type: LIVE_COMMAND_TYPE, name, value };
}

export function readLiveCommand(payload: unknown): { name: string; value: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { type?: unknown; name?: unknown; value?: unknown };
  if (data.type !== LIVE_COMMAND_TYPE) return null;
  if (typeof data.name !== 'string' || !data.name) return null;
  if (typeof data.value !== 'string') return null;
  return { name: data.name, value: data.value };
}
