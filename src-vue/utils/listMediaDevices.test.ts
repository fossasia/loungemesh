import { describe, expect, it } from 'vitest';
import { deviceLabel, listMediaDevices } from './listMediaDevices';

function fakeDevice(kind: MediaDeviceKind, deviceId: string, label = ''): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) } as MediaDeviceInfo;
}

describe('listMediaDevices', () => {
  it('groups devices by kind', async () => {
    const listed = await listMediaDevices(async () => [
      fakeDevice('audioinput', 'm1', 'Mic'),
      fakeDevice('videoinput', 'c1', 'Cam'),
      fakeDevice('audiooutput', 's1', 'Speakers'),
    ]);
    expect(listed.audioInputs).toHaveLength(1);
    expect(listed.videoInputs).toHaveLength(1);
    expect(listed.audioOutputs).toHaveLength(1);
  });

  it('returns empty lists when enumerate fails', async () => {
    const listed = await listMediaDevices(async () => {
      throw new Error('denied');
    });
    expect(listed).toEqual({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  });

  it('falls back when a device has no label', () => {
    expect(deviceLabel(fakeDevice('audioinput', 'x'), 'Microphone 1')).toBe('Microphone 1');
    expect(deviceLabel(fakeDevice('audioinput', 'x', '  Built-in  '), 'Microphone 1')).toBe(
      'Built-in',
    );
  });

  it('uses navigator.mediaDevices by default', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [fakeDevice('audioinput', 'm1', 'Mic')],
      },
    });
    const listed = await listMediaDevices();
    expect(listed.audioInputs).toHaveLength(1);
  });
});
