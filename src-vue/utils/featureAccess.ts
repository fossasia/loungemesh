export type GatedFeatureKey = 'chat' | 'notes' | 'whiteboard' | 'poll' | 'stage';
export type UserRole = 'host' | 'moderator' | 'attendee';

export interface FeatureAccessResult {
  /** Whether the feature should be visible in UI navigation/toolbars for this user */
  visible: boolean;
  /** Whether the user can interactively use the feature */
  use: boolean;
  /** Whether the user can moderate this feature (approve, clear, manage) */
  moderate: boolean;
  /** Whether the feature is disabled room-wide by the host */
  disabledByHost: boolean;
}

export const DEFAULT_ENABLED_FEATURES: Record<GatedFeatureKey, boolean> = {
  chat: true,
  notes: true,
  whiteboard: true,
  poll: true,
  stage: true,
};

/**
 * Single source of truth for feature accessibility across attendees, moderators, and hosts.
 *
 * Rules:
 * 1. If a feature is disabled by host room-wide:
 *    - Attendees & moderators: visible = false, use = false, moderate = false.
 *    - Host: visible = false in main UI (only visible in host settings with disabled indicator), use = false, moderate = false.
 *    - In no case can moderators moderate or use features that the host has disabled.
 * 2. If a feature is enabled:
 *    - Visible to everyone.
 *    - Host can always use and moderate.
 *    - Moderator can use and moderate.
 *    - Attendee can use unless an explicit user grant has revoked it (grant === false).
 */
export function featureAccess(
  feature: GatedFeatureKey,
  role: UserRole,
  enabledFeatures: Partial<Record<GatedFeatureKey, boolean>> = {},
  userGrants?: Partial<Record<string, boolean>>,
): FeatureAccessResult {
  const isEnabled = enabledFeatures[feature] !== false;

  if (!isEnabled) {
    return {
      visible: false,
      use: false,
      moderate: false,
      disabledByHost: true,
    };
  }

  const isHost = role === 'host';
  const isModerator = role === 'moderator';

  if (isHost) {
    return {
      visible: true,
      use: true,
      moderate: true,
      disabledByHost: false,
    };
  }

  if (isModerator) {
    return {
      visible: true,
      use: true,
      moderate: true,
      disabledByHost: false,
    };
  }

  // Attendee
  const isExplicitlyRevoked = userGrants?.[feature] === false;
  return {
    visible: true,
    use: !isExplicitlyRevoked,
    moderate: false,
    disabledByHost: false,
  };
}
