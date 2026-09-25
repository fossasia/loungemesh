import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { applyParticipantMegaphone, parseMegaphone } from './sessionMegaphone';

describe('sessionMegaphone', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('parses megaphone values', () => {
    expect(parseMegaphone(true)).toBe(true);
    expect(parseMegaphone('true')).toBe(true);
    expect(parseMegaphone(false)).toBe(false);
    expect(parseMegaphone('false')).toBe(false);
  });

  it('updates local and remote megaphone properties', () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('local-1');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('local-1');

    applyParticipantMegaphone('remote-1', true);
    expect(conference.users['remote-1']).toBeUndefined();

    conference.addUser('remote-1');
    applyParticipantMegaphone('remote-1', true);
    expect(conference.users['remote-1'].properties.megaphone).toBe(true);

    applyParticipantMegaphone('local-1', true);
    expect(features.megaphone).toBe(true);

    applyParticipantMegaphone('local-1', false);
    expect(features.megaphone).toBe(false);
  });

  it('syncs local megaphone from engine id when store id is unset', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('engine-only');
    applyParticipantMegaphone('engine-only', true);
    expect(features.megaphone).toBe(true);
  });
});
