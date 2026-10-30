export type RemoteAudioLike = {
  videoType?: string;
  getVideoType?: () => string | undefined;
  getTrack?: () => { label?: string } | undefined;
};

/**
 * Screen-share audio is a second audio track. Classify it from Jitsi's desktop
 * video type or the capture label. A second mic publish must stay the mic —
 * treating "already has audio" as screen audio drops the voice track.
 */
export function remoteAudioSlot(track: RemoteAudioLike): 'audio' | 'screenshareAudio' {
  const declared = track.videoType ?? track.getVideoType?.();
  if (declared === 'desktop') return 'screenshareAudio';
  let label = '';
  try {
    label = track.getTrack?.()?.label?.toLowerCase() ?? '';
  } catch {
    label = '';
  }
  if (
    label.includes('screen') ||
    label.includes('desktop') ||
    label.includes('tab') ||
    label.includes('monitor')
  ) {
    return 'screenshareAudio';
  }
  return 'audio';
}
