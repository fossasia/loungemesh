import type { JitsiTrack } from '@/types/jitsi';
import { collectMediaStreamTracks } from '@/utils/disposeJitsiTrack';

type RawTrackHolder = {
  getStream?: () => MediaStream | null;
  getOriginalStream?: () => MediaStream | null;
  stream?: MediaStream | null;
  getTrack?: () => MediaStreamTrack | null;
};

type TrackWithEvents = JitsiTrack & {
  attach?: (element: HTMLElement) => void;
  detach?: (element: HTMLElement) => void;
  addEventListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeEventListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function liveAudioTracks(stream: MediaStream | null | undefined): MediaStreamTrack[] {
  return stream?.getAudioTracks?.().filter((t) => t.readyState !== 'ended') ?? [];
}

function ignorePlaybackRejection(): void {
  /* autoplay blocked — attach still succeeded */
}

/** Attach a remote track to a hidden audio element (lib-jitsi's reliable cross-browser path). */
export function attachTrackToAudioElement(track: JitsiTrack, element: HTMLAudioElement): void {
  const t = track as TrackWithEvents;
  try {
    t.detach?.(element);
  } catch {
    /* not attached yet */
  }
  try {
    t.attach?.(element);
    element.autoplay = true;
    element.setAttribute('playsinline', '');
    void element.play().catch(ignorePlaybackRejection);
  } catch {
    /* attach may fail before the stream exists */
  }
}

/**
 * Resolve audio for Web Audio routing. Prefer track.attach() on `sink` so Firefox→Chrome
 * receives the same stream the browser would play natively.
 */
export function resolveRemoteAudioPlaybackStream(
  track: JitsiTrack,
  sink?: HTMLAudioElement | null,
): MediaStream | undefined {
  if (sink) attachTrackToAudioElement(track, sink);

  for (const stream of [
    sink?.srcObject as MediaStream | null | undefined,
    (track as RawTrackHolder).getOriginalStream?.(),
    (track as RawTrackHolder).getStream?.(),
    (track as RawTrackHolder).stream,
  ]) {
    if (stream && liveAudioTracks(stream).length) return stream;
  }

  const audioTracks = collectMediaStreamTracks(track).filter(
    (t) => t.kind === 'audio' && t.readyState !== 'ended',
  );
  if (!audioTracks.length) return undefined;

  if (typeof MediaStream !== 'undefined') {
    return new MediaStream(audioTracks);
  }
  return {
    id: 'loungemesh-playback',
    getAudioTracks: () => audioTracks,
    getTracks: () => audioTracks,
  } as unknown as MediaStream;
}

/** @deprecated Use resolveRemoteAudioPlaybackStream with a sink element for remote tracks. */
export function mediaStreamForJitsiAudioPlayback(track: JitsiTrack | undefined): MediaStream | undefined {
  if (!track) return undefined;
  return resolveRemoteAudioPlaybackStream(track);
}

function jitsiTrackEventName(key: 'TRACK_STREAMING_STATUS_CHANGED' | 'TRACK_MUTE_CHANGED'): string | undefined {
  const events = (window.JitsiMeetJS as { events?: { track?: Record<string, string> } } | undefined)
    ?.events?.track;
  return events?.[key];
}

/**
 * Invoke `onReady` once the track exposes a live audio MediaStream (or attached sink).
 */
export function whenJitsiAudioPlaybackReady(
  track: JitsiTrack,
  onReady: () => void,
  sink?: HTMLAudioElement | null,
): () => void {
  const tryReady = () => {
    if (resolveRemoteAudioPlaybackStream(track, sink)) onReady();
  };
  tryReady();

  const t = track as TrackWithEvents;
  const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
  const streamingEvent = jitsiTrackEventName('TRACK_STREAMING_STATUS_CHANGED');
  const muteEvent = jitsiTrackEventName('TRACK_MUTE_CHANGED');

  const onTrackSignal = (status?: unknown) => {
    if (status === undefined || status === 'active' || status === 'restoring') tryReady();
  };

  if (streamingEvent && t.addEventListener) {
    t.addEventListener(streamingEvent, onTrackSignal);
    handlers.push({ event: streamingEvent, handler: onTrackSignal });
  }
  if (muteEvent && t.addEventListener) {
    t.addEventListener(muteEvent, onTrackSignal);
    handlers.push({ event: muteEvent, handler: onTrackSignal });
  }

  let attempts = 0;
  const intervalId = window.setInterval(() => {
    attempts += 1;
    tryReady();
    if (resolveRemoteAudioPlaybackStream(track, sink) || attempts >= 50) {
      window.clearInterval(intervalId);
    }
  }, 100);

  return () => {
    window.clearInterval(intervalId);
    for (const { event, handler } of handlers) {
      t.removeEventListener?.(event, handler);
    }
  };
}
