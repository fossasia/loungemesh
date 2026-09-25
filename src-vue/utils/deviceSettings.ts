export type DeviceKind = 'audioinput' | 'videoinput' | 'audiooutput';

export function deviceGroupLabel(kind: DeviceKind): string {
  if (kind === 'audioinput') return 'Microphone';
  if (kind === 'videoinput') return 'Camera';
  return 'Speaker';
}

export function fallbackDeviceLabel(kind: DeviceKind, index: number): string {
  return `${deviceGroupLabel(kind)} ${index + 1}`;
}

export function supportsAudioOutput(
  proto: { setSinkId?: unknown } = HTMLMediaElement.prototype,
): boolean {
  return typeof proto.setSinkId === 'function';
}
