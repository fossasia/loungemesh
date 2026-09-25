import { describe, expect, it } from 'vitest';
import { deviceGroupLabel, fallbackDeviceLabel, supportsAudioOutput } from './deviceSettings';

describe('deviceSettings', () => {
  it('labels device groups and fallbacks', () => {
    expect(deviceGroupLabel('audioinput')).toBe('Microphone');
    expect(deviceGroupLabel('videoinput')).toBe('Camera');
    expect(deviceGroupLabel('audiooutput')).toBe('Speaker');
    expect(fallbackDeviceLabel('audioinput', 0)).toBe('Microphone 1');
  });

  it('detects setSinkId support', () => {
    expect(supportsAudioOutput({ setSinkId: async () => undefined })).toBe(true);
    expect(supportsAudioOutput({})).toBe(false);
    expect(typeof supportsAudioOutput()).toBe('boolean');
  });
});
