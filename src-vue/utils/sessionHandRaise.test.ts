import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { applyParticipantHandRaised, parseHandRaised } from './sessionHandRaise';

vi.mock('@/utils/uiSounds', () => ({
  playUiSound: vi.fn(),
}));

describe('sessionHandRaise', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('parses handRaised values', () => {
    expect(parseHandRaised(true)).toBe(true);
    expect(parseHandRaised('true')).toBe(true);
    expect(parseHandRaised(false)).toBe(false);
    expect(parseHandRaised('false')).toBe(false);
  });

  it('updates participant properties and notifies remote raises', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const conference = useConferenceStore();
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('local-1');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('local-1');

    applyParticipantHandRaised('remote-1', true);
    expect(conference.users['remote-1']).toBeUndefined();

    conference.addUser('remote-1');
    applyParticipantHandRaised('remote-1', true, { notify: true });
    expect(conference.users['remote-1'].properties.handRaised).toBe(true);
    expect(playUiSound).toHaveBeenCalledWith('handRaise');

    applyParticipantHandRaised('local-1', true, { notify: true });
    expect(features.handRaised).toBe(true);
    expect(conference.users['local-1']).toBeUndefined();
    expect(playUiSound).toHaveBeenCalledTimes(1);
  });

  it('syncs local hand state from engine id when store id is unset', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('engine-only');

    applyParticipantHandRaised('engine-only', true);
    expect(features.handRaised).toBe(true);

    applyParticipantHandRaised('engine-only', false);
    expect(features.handRaised).toBe(false);
  });

  it('patches remote hand state without notify when lowered', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const conference = useConferenceStore();
    conference.addUser('remote-1');
    applyParticipantHandRaised('remote-1', true, { notify: true });
    applyParticipantHandRaised('remote-1', false, { notify: true });

    expect(conference.users['remote-1'].properties.handRaised).toBe(false);
    expect(playUiSound).toHaveBeenCalledTimes(1);
  });

  it('does not replay hand raise sound when already raised', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const conference = useConferenceStore();
    conference.addUser('remote-1');
    applyParticipantHandRaised('remote-1', true, { notify: true });
    applyParticipantHandRaised('remote-1', true, { notify: true });

    expect(conference.users['remote-1'].properties.handRaised).toBe(true);
    expect(playUiSound).toHaveBeenCalledTimes(1);
  });
});
