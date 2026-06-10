import { describe, expect, it } from 'vitest';
import { defaultUserGrants } from '@/types/userGrants';
import {
  canUseFeature,
  effectiveGrants,
  grantsPayloadForSync,
  legacyAccessToDefaults,
  mergeGrants,
} from './sessionAccess';

describe('sessionAccess', () => {
  it('merges room and per-user grants with host override', () => {
    const room = defaultUserGrants();
    expect(effectiveGrants('u1', room, {}, false)).toEqual(room);
    expect(effectiveGrants('host', room, {}, true).notes).toBe(true);
    const grants = effectiveGrants('u1', { ...room, notes: true }, { u1: { poll: true } }, false);
    expect(grants.notes).toBe(true);
    expect(grants.poll).toBe(true);
  });

  it('checks individual feature flags', () => {
    const grants = mergeGrants(defaultUserGrants(), { notes: true });
    expect(canUseFeature(grants, 'notes')).toBe(true);
    expect(canUseFeature(grants, 'poll')).toBe(false);
  });

  it('builds sync payloads and legacy defaults', () => {
    const room = mergeGrants(defaultUserGrants(), { notes: true });
    expect(legacyAccessToDefaults({ notes: true, whiteboard: false })).toEqual({
      notes: true,
      whiteboard: false,
    });
    expect(grantsPayloadForSync(room, 'u2', { u2: { poll: true } })).toEqual({
      defaults: room,
      userId: 'u2',
      grants: { poll: true },
    });
  });
});
