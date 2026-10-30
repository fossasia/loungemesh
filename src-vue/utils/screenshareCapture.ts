import type { JitsiMeetJS, JitsiTrack } from '@/types/jitsi';

/** Desktop capture stays at 720p. Phones omit source-type and pixel locks that getDisplayMedia rejects. */
export function desktopCaptureRequest(mobile: boolean): Record<string, unknown> {
  if (mobile) {
    return {
      devices: ['desktop'],
      desktopSharingFrameRate: { max: 24 },
      constraints: {
        video: {
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 15, max: 24 },
        },
      },
    };
  }
  return {
    devices: ['desktop'],
    desktopSharingSources: ['screen', 'window', 'tab'],
    desktopSharingFrameRate: { min: 15, max: 30 },
    constraints: {
      video: {
        height: { ideal: 720, max: 720 },
        width: { ideal: 1280, max: 1280 },
        frameRate: { ideal: 24, max: 30 },
      },
    },
  };
}

export function isMobileCaptureDevice(
  userAgent = navigator.userAgent,
  width = window.innerWidth,
  coarsePointer = typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches === true,
): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return true;
  return coarsePointer && width <= 900;
}

/** A second video source (`-v1`) is a screenshare even when videoType has not been set yet. */
export function isDesktopShareTrack(track: {
  videoType?: string;
  getVideoType?: () => string;
  getSourceName?: () => string;
}): boolean {
  const typed = track.getVideoType?.() || track.videoType;
  if (typed === 'desktop') return true;
  const source = track.getSourceName?.() ?? '';
  return source.endsWith('-v1');
}

function markDesktop(tracks: JitsiTrack[]): JitsiTrack[] {
  for (const track of tracks) {
    if (track.getType() === 'video') track.videoType = 'desktop';
  }
  return tracks;
}

/** Capture a screen. On phones, fall back to getDisplayMedia when the desktop capturer rejects the request. */
export async function acquireDesktopTracks(
  jsMeet: JitsiMeetJS,
  options?: { mobile?: boolean; getDisplayMedia?: () => Promise<MediaStream> },
): Promise<JitsiTrack[]> {
  const mobile = options?.mobile ?? isMobileCaptureDevice();
  const create = jsMeet.createLocalTracks as (opts: Record<string, unknown>) => Promise<JitsiTrack[]>;
  try {
    return markDesktop(
      await create({
        ...desktopCaptureRequest(mobile),
        firePermissionPromptIsShownEvent: true,
      }),
    );
  } catch (error) {
    if (!mobile) throw error;
    const getDisplay =
      options?.getDisplayMedia ??
      (() =>
        navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 24 } },
          audio: false,
        }));
    const stream = await getDisplay();
    if (typeof jsMeet.createLocalTracksFromMediaStreams !== 'function') {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
    return markDesktop(
      await jsMeet.createLocalTracksFromMediaStreams([
        {
          stream,
          mediaType: 'video',
          videoType: 'desktop',
          sourceType: 'desktop',
        },
      ]),
    );
  }
}
