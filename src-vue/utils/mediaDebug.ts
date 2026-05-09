import { conferenceOptions } from '@/config/jitsiOptions';

const LOG_PREFIX = '[flowspace:media]';
const LS_KEY = 'flowspace:media-debug';

type TrackLike = {
  getType?: () => string;
  getParticipantId?: () => string;
  isMuted?: () => boolean;
  isLocal?: () => boolean;
  videoType?: string;
  getTrackLabel?: () => string;
  getOriginalStream?: () => MediaStream;
  attach?: (el: HTMLElement) => void;
};

/** True when `VITE_MEDIA_DEBUG=true` or `localStorage['flowspace:media-debug'] === '1'`. */
export function isMediaDebugEnabled(): boolean {
  if (import.meta.env.VITE_MEDIA_DEBUG === 'true') return true;
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LS_KEY) === '1';
}

/** How to turn on video/audio diagnostics (shown once when debug is enabled). */
export function mediaDebugHelp(): void {
  if (!isMediaDebugEnabled()) return;
  console.info(
    LOG_PREFIX,
    'Debug logging on. Filter console by "flowspace:media".',
    'Disable: localStorage.removeItem("flowspace:media-debug") and reload.',
    'Or unset VITE_MEDIA_DEBUG and rebuild.',
  );
}

export function mediaDebug(
  scope: string,
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (!isMediaDebugEnabled()) return;
  if (detail === undefined) {
    console.info(LOG_PREFIX, scope, message);
  } else {
    console.info(LOG_PREFIX, scope, message, detail);
  }
}

export function mediaDebugTrack(
  scope: string,
  event: string,
  track: unknown,
  extra?: Record<string, unknown>,
): void {
  if (!isMediaDebugEnabled()) return;
  const t = track as TrackLike;
  const stream = t.getOriginalStream?.();
  mediaDebug(scope, event, {
    type: t.getType?.(),
    participantId: t.getParticipantId?.(),
    muted: t.isMuted?.(),
    local: t.isLocal?.(),
    videoType: t.videoType,
    label: t.getTrackLabel?.(),
    streamId: stream?.id,
    streamActive: stream?.active,
    videoTracks: stream?.getVideoTracks?.()?.length,
    audioTracks: stream?.getAudioTracks?.()?.length,
    ...extra,
  });
}

export function mediaDebugVideoElement(
  scope: string,
  event: string,
  participantId: string,
  el: HTMLVideoElement | null,
  extra?: Record<string, unknown>,
): void {
  if (!isMediaDebugEnabled()) return;
  const stream = el?.srcObject;
  mediaDebug(scope, event, {
    participantId,
    hasElement: !!el,
    videoWidth: el?.videoWidth ?? 0,
    videoHeight: el?.videoHeight ?? 0,
    readyState: el?.readyState,
    paused: el?.paused,
    elementMuted: el?.muted,
    hasSrcObject: !!stream,
    srcObjectId:
      stream && typeof stream === 'object' && 'id' in stream
        ? String((stream as MediaStream).id)
        : undefined,
    ...extra,
  });
}

/** Log attach outcome after the browser has had a frame to decode. */
export function mediaDebugVideoAfterAttach(
  scope: string,
  participantId: string,
  el: HTMLVideoElement | null,
): void {
  if (!isMediaDebugEnabled() || !el) return;
  const snap = () => mediaDebugVideoElement(scope, 'attach-settled', participantId, el);
  el.addEventListener('loadedmetadata', snap, { once: true });
  el.addEventListener('error', () => mediaDebug(scope, 'video-element-error', { participantId }), {
    once: true,
  });
  window.setTimeout(snap, 500);
}

export type MediaUserRow = {
  id: string;
  mute: boolean;
  hasVideo: boolean;
  videoMuted?: boolean;
  videoType?: string;
  hasAudio: boolean;
};

/** One-line hint when logs show colibri/ICE misconfiguration (always logged if debug on). */
export function mediaDebugBridgeHint(colibriUrl?: string): void {
  if (!isMediaDebugEnabled()) return;
  const url = colibriUrl ?? '';
  if (/colibri-ws\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url)) {
    mediaDebug('diagnosis', 'colibri URL uses Docker bridge IP — set server DOCKER_HOST_ADDRESS to public Elastic IP and redeploy', {
      colibriUrl: url,
    });
  }
  if (url.includes('colibri-ws') && url.includes('1006')) {
    mediaDebug('diagnosis', 'colibri WebSocket failed — remote tracks may never arrive; fix DOCKER_HOST_ADDRESS or set ENABLE_COLIBRI_WEBSOCKET=0 on server');
  }
}

export function logMediaStateSnapshot(args: {
  reason?: string;
  joined: boolean;
  localId: string;
  cameraOff: boolean;
  hasLocalVideo: boolean;
  localVideoMuted?: boolean;
  users: MediaUserRow[];
  visibleUserIds: string[];
  usersOnStage: string[];
}): void {
  if (!isMediaDebugEnabled()) return;
  mediaDebug('state', 'snapshot', {
    ...args,
    openBridgeChannel: conferenceOptions.openBridgeChannel,
    receiverConstraintsActive: conferenceOptions.openBridgeChannel,
  });
}
