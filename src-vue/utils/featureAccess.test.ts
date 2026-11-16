import { describe, it, expect } from 'vitest';
import { featureAccess, DEFAULT_ENABLED_FEATURES } from './featureAccess';

describe('featureAccess', () => {
  it('returns disabled result when feature is disabled by host for any role', () => {
    const disabledFeatures = { ...DEFAULT_ENABLED_FEATURES, whiteboard: false };

    const hostAccess = featureAccess('whiteboard', 'host', disabledFeatures);
    expect(hostAccess).toEqual({
      visible: false,
      use: false,
      moderate: false,
      disabledByHost: true,
    });

    const modAccess = featureAccess('whiteboard', 'moderator', disabledFeatures);
    expect(modAccess).toEqual({
      visible: false,
      use: false,
      moderate: false,
      disabledByHost: true,
    });

    const attendeeAccess = featureAccess('whiteboard', 'attendee', disabledFeatures);
    expect(attendeeAccess).toEqual({
      visible: false,
      use: false,
      moderate: false,
      disabledByHost: true,
    });
  });

  it('allows full access to host when feature is enabled', () => {
    const access = featureAccess('notes', 'host', DEFAULT_ENABLED_FEATURES);
    expect(access).toEqual({
      visible: true,
      use: true,
      moderate: true,
      disabledByHost: false,
    });
  });

  it('allows use and moderation to moderator when feature is enabled', () => {
    const access = featureAccess('poll', 'moderator', DEFAULT_ENABLED_FEATURES);
    expect(access).toEqual({
      visible: true,
      use: true,
      moderate: true,
      disabledByHost: false,
    });
  });

  it('allows use to attendee when feature is enabled and not revoked', () => {
    const access = featureAccess('chat', 'attendee', DEFAULT_ENABLED_FEATURES);
    expect(access).toEqual({
      visible: true,
      use: true,
      moderate: false,
      disabledByHost: false,
    });
  });

  it('revokes attendee use if userGrants explicitly sets feature to false', () => {
    const access = featureAccess('chat', 'attendee', DEFAULT_ENABLED_FEATURES, { chat: false });
    expect(access).toEqual({
      visible: true,
      use: false,
      moderate: false,
      disabledByHost: false,
    });
  });

  it('defaults to enabled if enabledFeatures is empty or key not specified', () => {
    const access = featureAccess('stage', 'attendee', {});
    expect(access).toEqual({
      visible: true,
      use: true,
      moderate: false,
      disabledByHost: false,
    });
  });
});
