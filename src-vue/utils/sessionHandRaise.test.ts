import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
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
    local.setMyID('local-1');
    vi.spyOn(getMediaEngineInstance(), 'getLocalUserId').mockReturnValue('local-1');

    applyParticipantHandRaised('remote-1', true, { notify: true });
    expect(conference.users['remote-1'].properties.handRaised).toBe(true);
    expect(playUiSound).toHaveBeenCalledWith('handRaise');

    applyParticipantHandRaised('local-1', true, { notify: true });
    expect(playUiSound).toHaveBeenCalledTimes(1);
  });
});
