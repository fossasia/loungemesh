export type ListedMediaDevices = {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
};

export async function listMediaDevices(
  enumerate: () => Promise<MediaDeviceInfo[]> = () => navigator.mediaDevices.enumerateDevices(),
): Promise<ListedMediaDevices> {
  let devices: MediaDeviceInfo[] = [];
  try {
    devices = await enumerate();
  } catch {
    devices = [];
  }
  return {
    audioInputs: devices.filter((d) => d.kind === 'audioinput'),
    videoInputs: devices.filter((d) => d.kind === 'videoinput'),
    audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
  };
}

export function deviceLabel(device: MediaDeviceInfo, fallback: string): string {
  return device.label?.trim() || fallback;
}
