import type { JitsiTrack } from '@/types/jitsi';

const SPEAKING_THRESHOLD = 18;
const SPEAKING_HYSTERESIS = 10;

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

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.65;
  source.connect(analyser);

  const buf = new Uint8Array(analyser.frequencyBinCount);
  let speaking = false;
  let raf = 0;

  const tick = () => {
    if (track.isMuted?.()) {
      if (speaking) {
        speaking = false;
        onChange(false);
      }
      raf = requestAnimationFrame(tick);
      return;
    }
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    const avg = sum / buf.length;
    const next =
      speaking ? avg > SPEAKING_HYSTERESIS : avg > SPEAKING_THRESHOLD;
    if (next !== speaking) {
      speaking = next;
      onChange(speaking);
    }
    raf = requestAnimationFrame(tick);
  };

  if (ctx.state === 'suspended') void ctx.resume();
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    try {
      source.disconnect();
      analyser.disconnect();
      void ctx.close();
    } catch {
      /* ignore */
    }
  };
}
