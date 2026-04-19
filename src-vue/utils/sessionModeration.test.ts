import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { kickParticipant, muteParticipant } from './sessionModeration';

describe('sessionModeration', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('mutes known participants and ignores unknown ids', () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    conference.addUser('peer');
    muteParticipant(conference, engine, 'peer');
    expect(conference.users.peer.mute).toBe(true);
    muteParticipant(conference, engine, 'missing');
    expect(cmdSpy).toHaveBeenCalledTimes(2);
  });

  it('kicks participants from the conference store', () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    conference.addUser('peer');
    kickParticipant(conference, engine, 'peer');
    expect(conference.users.peer).toBeUndefined();
  });
});
