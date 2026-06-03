import {
  defaultUserGrants,
  fullUserGrants,
  type FeatureKey,
  type UserGrants,
} from '@/types/userGrants';

export type AccessCommandPayload = {
  defaults?: Partial<UserGrants>;
  userId?: string;
  grants?: Partial<UserGrants>;
};

/** Effective grants for a participant (room defaults merged with per-user overrides). */
export function effectiveGrants(
  userId: string,
  roomDefaults: UserGrants,
  userGrants: Record<string, Partial<UserGrants>>,
  isHost: boolean,
): UserGrants {
  if (isHost) return fullUserGrants();
  const base = { ...roomDefaults, ...(userGrants[userId] ?? {}) };
  return {
    notes: !!base.notes,
    whiteboard: !!base.whiteboard,
    poll: !!base.poll,
    stage: !!base.stage,
  };
}

export function canUseFeature(grants: UserGrants, key: FeatureKey): boolean {
  return grants[key];
}

/** Merge partial grants into room defaults or a user entry. */
export function mergeGrants(current: UserGrants, patch: Partial<UserGrants>): UserGrants {
  return {
    notes: patch.notes ?? current.notes,
    whiteboard: patch.whiteboard ?? current.whiteboard,
    poll: patch.poll ?? current.poll,
    stage: patch.stage ?? current.stage,
  };
}

/** Normalize legacy access payloads that only set notes/whiteboard room flags. */
export function legacyAccessToDefaults(data: {
  notes?: boolean;
  whiteboard?: boolean;
}): Partial<UserGrants> {
  const patch: Partial<UserGrants> = {};
  if (data.notes != null) patch.notes = data.notes;
  if (data.whiteboard != null) patch.whiteboard = data.whiteboard;
  return patch;
}

export function grantsPayloadForSync(
  roomDefaults: UserGrants,
  userId: string,
  userGrants: Record<string, Partial<UserGrants>>,
): AccessCommandPayload {
  return {
    defaults: roomDefaults,
    userId,
    grants: userGrants[userId] ?? {},
  };
}
