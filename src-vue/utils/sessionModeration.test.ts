import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import {
  disableParticipantCamera,
  kickParticipant,
  muteParticipant,
  setParticipantMediaLock,
} from './sessionModeration';

describe('sessionModeration', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('mutes known participants and ignores unknown ids', () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');
    conference.addUser('peer');
    muteParticipant(conference, engine, 'peer');
    expect(conference.users.peer.mute).toBe(true);
    expect(volSpy).toHaveBeenCalledWith('peer', 0);

    features.hostEmail = 'host@example.com';
    muteParticipant(conference, engine, 'missing');
    expect(cmdSpy).toHaveBeenCalledTimes(2);
    expect(cmdSpy).toHaveBeenLastCalledWith(
      'mod',
      JSON.stringify({ action: 'mute', id: 'missing', email: 'host@example.com' }),
    );
  });

  it('disables participant camera for known and unknown ids', () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    conference.addUser('peer');
    conference.users.peer.video = { getType: () => 'video' } as never;

    disableParticipantCamera(conference, engine, 'peer');
    expect(conference.users.peer.video).toBeUndefined();
    expect(cmdSpy).toHaveBeenCalledWith(
      'mod',
      JSON.stringify({ action: 'camera_off', id: 'peer' }),
    );

    disableParticipantCamera(conference, engine, 'missing');
    expect(cmdSpy).toHaveBeenCalledTimes(2);
  });

  it('locks and unlocks participant mic and camera', () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');
    const volSpy = vi.spyOn(engine, 'setParticipantVolume');

    conference.addUser('peer');
    conference.users.peer.video = { getType: () => 'video' } as never;

    setParticipantMediaLock(conference, engine, 'peer', { mic: true, camera: true });
    expect(features.mediaLocks.peer).toEqual({ mic: true, camera: true });
    expect(conference.users.peer.mute).toBe(true);
    expect(volSpy).toHaveBeenCalledWith('peer', 0);
    expect(conference.users.peer.video).toBeUndefined();
    expect(cmdSpy).toHaveBeenLastCalledWith(
      'mod',
      JSON.stringify({ action: 'lock_media', id: 'peer', mic: true, camera: true }),
    );

    setParticipantMediaLock(conference, engine, 'peer', { mic: false, camera: false });
    expect(features.mediaLocks.peer).toBeUndefined();
    expect(cmdSpy).toHaveBeenLastCalledWith(
      'mod',
      JSON.stringify({ action: 'lock_media', id: 'peer', mic: false, camera: false }),
    );

    setParticipantMediaLock(conference, engine, 'missing', { mic: true });
    expect(features.mediaLocks.missing).toEqual({ mic: true, camera: undefined });
  });

  it('kicks participants from the conference store', () => {
    const conference = useConferenceStore();
    const engine = getMediaEngineInstance();
    conference.addUser('peer');
    kickParticipant(conference, engine, 'peer');
    expect(conference.users.peer).toBeUndefined();
  });
});
