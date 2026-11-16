import { stopMediaStreamTracks } from '@/utils/disposeJitsiTrack';

export type ClearMediaElementOptions = {
  /** Stop underlying capture tracks — use for local preview release only. */
  stopTracks?: boolean;
};

/** Drop any attached MediaStream so the browser can release camera/mic hardware. */
export function clearMediaElement(
  element: HTMLMediaElement | null | undefined,
  options: ClearMediaElementOptions = {},
): void {
  if (!element) return;
  try {
    element.pause();
  } catch {
    /* already paused / not ready */
  }
  if (options.stopTracks) {
    const stream = element.srcObject as MediaStream | null;
    const tracks = stream?.getTracks?.();
    if (tracks?.length) stopMediaStreamTracks(tracks);
  }
  element.srcObject = null;
  element.removeAttribute('src');
}

/** Give the browser a frame to detach preview elements before stopping capture. */
export function waitForMediaElementDetach(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
