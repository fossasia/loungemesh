export type MediaDevicePrefs = {
  audioinput?: string;
  videoinput?: string;
  audiooutput?: string;
};

export const MEDIA_DEVICE_PREFS_KEY = 'loungemesh.mediaDevices';

function readStore(): unknown {
  try {
    const raw = localStorage.getItem(MEDIA_DEVICE_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadMediaDevicePrefs(): MediaDevicePrefs {
  const parsed = readStore();
  if (!parsed || typeof parsed !== 'object') return {};
  const rec = parsed as Record<string, unknown>;
  const prefs: MediaDevicePrefs = {};
  if (typeof rec.audioinput === 'string' && rec.audioinput) prefs.audioinput = rec.audioinput;
  if (typeof rec.videoinput === 'string' && rec.videoinput) prefs.videoinput = rec.videoinput;
  if (typeof rec.audiooutput === 'string' && rec.audiooutput) prefs.audiooutput = rec.audiooutput;
  return prefs;
}

export function saveMediaDevicePrefs(patch: MediaDevicePrefs): MediaDevicePrefs {
  const next = { ...loadMediaDevicePrefs(), ...patch };
  for (const key of ['audioinput', 'videoinput', 'audiooutput'] as const) {
    if (!next[key]) delete next[key];
  }
  try {
    localStorage.setItem(MEDIA_DEVICE_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return next;
}

export type CreateTrackDeviceOpts = {
  audioDeviceId?: string;
  videoDeviceId?: string;
};

export function createTrackDeviceOpts(
  devices: Array<'audio' | 'video' | 'desktop'>,
  prefs: MediaDevicePrefs = loadMediaDevicePrefs(),
): CreateTrackDeviceOpts | undefined {
  const opts: CreateTrackDeviceOpts = {};
  if (devices.includes('audio') && prefs.audioinput) opts.audioDeviceId = prefs.audioinput;
  if (devices.includes('video') && prefs.videoinput) opts.videoDeviceId = prefs.videoinput;
  return opts.audioDeviceId || opts.videoDeviceId ? opts : undefined;
}
