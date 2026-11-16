/**
 * Canonical LoungeMesh user types matching Eventyay 1:1.
 */
export type LoungeMeshRole = 'host' | 'moderator' | 'attendee';

/**
 * EventyayRole represents the full set of external/legacy roles that map into LoungeMesh.
 */
export type EventyayRole = LoungeMeshRole | 'reviewer' | 'speaker' | 'guest';

export type Capability =
  | 'settings' // change meet settings, lobby, access defaults, background
  | 'moderate' // kick, promote to stage, clear whiteboard
  | 'poll_manage'
  | 'notes'
  | 'whiteboard'
  | 'record'
  | 'review_panel'
  | 'speak';

export const ROLE_CAPABILITIES: Record<EventyayRole, Capability[]> = {
  host: ['settings', 'moderate', 'poll_manage', 'notes', 'whiteboard', 'record', 'review_panel', 'speak'],
  // moderate and review unified into moderator
  moderator: ['moderate', 'poll_manage', 'notes', 'whiteboard', 'record', 'review_panel', 'speak'],
  reviewer: ['moderate', 'poll_manage', 'notes', 'whiteboard', 'record', 'review_panel', 'speak'],
  // speaker, attendee, and guest unified into attendee
  speaker: ['notes', 'whiteboard', 'speak'],
  attendee: ['notes', 'whiteboard', 'speak'],
  guest: ['notes', 'whiteboard', 'speak'],
};

export function isEventyayRole(value: unknown): value is EventyayRole {
  return typeof value === 'string' && value in ROLE_CAPABILITIES;
}

/**
 * Normalizes any external or legacy role into the canonical LoungeMesh 1:1 user type.
 */
export function normalizeRole(role: string): LoungeMeshRole {
  if (role === 'host') return 'host';
  if (role === 'moderator' || role === 'reviewer') return 'moderator';
  return 'attendee';
}

/** Capabilities for a role; attendee/guest additionally get room defaults. */
export function capabilitiesFor(
  role: EventyayRole,
  roomDefaults?: { notes?: boolean; whiteboard?: boolean; poll?: boolean } | null,
): Capability[] {
  const caps = new Set<Capability>(ROLE_CAPABILITIES[role]);
  if (role === 'attendee' || role === 'guest') {
    if (roomDefaults?.notes) caps.add('notes');
    if (roomDefaults?.whiteboard) caps.add('whiteboard');
  }
  return [...caps];
}

export function resolveMaxParticipants(requested: number | undefined | null): number {
  const envMax = Number.parseInt(process.env.LOUNGEMESH_MAX_PARTICIPANTS || '100', 10) || 100;
  const wanted = Number.isFinite(requested as number) && (requested as number) > 0 ? (requested as number) : 50;
  return Math.min(Math.floor(wanted), envMax);
}
