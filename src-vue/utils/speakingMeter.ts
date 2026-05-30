import type { JitsiTrack } from '@/types/jitsi';
import { startSpeakingLevelMonitor } from '@/utils/speakingLevel';
import { whenPlaybackUnlocked } from '@/utils/resumeMediaPlayback';

function streamFromTrack(track: JitsiTrack): MediaStream | undefined {
  return (track as unknown as { getOriginalStream?: () => MediaStream }).getOriginalStream?.();
}

/** Poll mic level from a Jitsi audio track; calls back when speaking state changes. */
export function watchTrackSpeaking(
  track: JitsiTrack,
  onChange: (speaking: boolean) => void,
): () => void {
  const stream = streamFromTrack(track);
  if (!stream?.getAudioTracks || stream.getAudioTracks().length === 0) {
    return () => {};
  }

  let stopped = false;
  let cleanup = () => {};

  void whenPlaybackUnlocked().then(() => {
    if (stopped) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    source.connect(analyser);

    if (ctx.state === 'suspended') void ctx.resume();

    cleanup = startSpeakingLevelMonitor({
      analyser,
      isInactive: () => track.isMuted?.() ?? false,
      onChange,
    });

    const priorCleanup = cleanup;
    cleanup = () => {
      priorCleanup();
      try {
        source.disconnect();
        analyser.disconnect();
        void ctx.close();
      } catch {
        /* ignore */
      }
    };
  });

  return () => {
    stopped = true;
    cleanup();
  };
}
