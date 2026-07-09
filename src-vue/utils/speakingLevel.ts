export const SPEAKING_THRESHOLD = 5;
export const SPEAKING_HYSTERESIS = 2.5;

/** Poll frequency data and report when speaking state changes. */
export function startSpeakingLevelMonitor(options: {
  analyser: AnalyserNode;
  isInactive: () => boolean;
  onChange: (speaking: boolean) => void;
}): () => void {
  const { analyser, isInactive, onChange } = options;
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.65;
  const buf = new Uint8Array(analyser.frequencyBinCount);
  let speaking = false;
  let raf = 0;

  const tick = () => {
    if (isInactive()) {
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
    const next = speaking ? avg > SPEAKING_HYSTERESIS : avg > SPEAKING_THRESHOLD;
    if (next !== speaking) {
      speaking = next;
      onChange(speaking);
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    if (speaking) onChange(false);
  };
}
