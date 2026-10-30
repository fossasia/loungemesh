import { describe, expect, it } from 'vitest';
import { remoteAudioSlot } from './remoteAudioSlot';

describe('remoteAudioSlot', () => {
  it('treats a plain mic as voice audio', () => {
    expect(remoteAudioSlot({})).toBe('audio');
    expect(remoteAudioSlot({ videoType: 'camera', getTrack: () => ({ label: 'Microphone' }) })).toBe(
      'audio',
    );
  });

  it('treats desktop and screen-capture audio as screenshare audio', () => {
    expect(remoteAudioSlot({ videoType: 'desktop' })).toBe('screenshareAudio');
    expect(remoteAudioSlot({ getVideoType: () => 'desktop' })).toBe('screenshareAudio');
    expect(remoteAudioSlot({ getTrack: () => ({ label: 'Screen 1' }) })).toBe('screenshareAudio');
    expect(remoteAudioSlot({ getTrack: () => ({ label: 'Tab audio' }) })).toBe('screenshareAudio');
    expect(remoteAudioSlot({ getTrack: () => ({ label: 'Monitor capture' }) })).toBe(
      'screenshareAudio',
    );
  });

  it('falls back to voice audio when the track label cannot be read', () => {
    expect(
      remoteAudioSlot({
        getTrack: () => {
          throw new Error('gone');
        },
      }),
    ).toBe('audio');
    expect(remoteAudioSlot({ getTrack: () => undefined })).toBe('audio');
  });
});
