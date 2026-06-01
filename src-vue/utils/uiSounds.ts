import { unlockAudioContextConstructor } from '@/utils/jitsiConsole';

export type UiSoundId =
  | 'tap'
  | 'toggleOn'
  | 'toggleOff'
  | 'handRaise'
  | 'handLower'
  | 'reaction'
  | 'panel'
  | 'send'
  | 'record'
  | 'recordStop'
  | 'leave'
  | 'success'
  | 'chatMessage';

let audioContext: AudioContext | undefined;

function uiSoundsDisabled(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem('loungemesh:ui-sounds') === '0';
}

/** Test helper */
export function resetUiSoundsForTests(): void {
  audioContext = undefined;
}

function getAudioContext(): AudioContext | undefined {
  if (typeof window === 'undefined' || uiSoundsDisabled()) return undefined;
  unlockAudioContextConstructor();
  if (!audioContext || audioContext.state === 'closed') {
    try {
      audioContext = new AudioContext();
    } catch {
      return undefined;
    }
  }
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

type ToneOptions = {
  freq: number;
  endFreq?: number;
  at?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
};

function playTone(options: ToneOptions): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const at = options.at ?? 0;
  const now = ctx.currentTime + at;
  const duration = options.duration;
  const peak = options.volume ?? 0.055;

  const gain = ctx.createGain();
  const osc = ctx.createOscillator();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, now);
  if (options.endFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(options.endFreq, 1), now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playSequence(notes: ToneOptions[]): void {
  for (const note of notes) playTone(note);
}

/** Short UI feedback sound — safe to call from any click handler. */
export function playUiSound(id: UiSoundId): void {
  if (uiSoundsDisabled()) return;

  switch (id) {
    case 'tap':
      playTone({ freq: 720, endFreq: 540, duration: 0.05, type: 'triangle', volume: 0.04 });
      break;
    case 'toggleOn':
      playSequence([
        { freq: 440, duration: 0.05, volume: 0.045 },
        { freq: 660, at: 0.04, duration: 0.07, volume: 0.05 },
      ]);
      break;
    case 'toggleOff':
      playTone({ freq: 520, endFreq: 360, duration: 0.07, type: 'triangle', volume: 0.045 });
      break;
    case 'handRaise':
      playSequence([
        { freq: 659, duration: 0.09, volume: 0.075, type: 'triangle' },
        { freq: 880, at: 0.08, duration: 0.09, volume: 0.08, type: 'triangle' },
        { freq: 1175, at: 0.16, duration: 0.14, volume: 0.085, type: 'triangle' },
      ]);
      break;
    case 'handLower':
      playSequence([
        { freq: 622, duration: 0.05, volume: 0.045 },
        { freq: 415, at: 0.04, duration: 0.08, volume: 0.04 },
      ]);
      break;
    case 'reaction':
      playTone({ freq: 980, endFreq: 1240, duration: 0.08, type: 'triangle', volume: 0.05 });
      break;
    case 'panel':
      playTone({ freq: 380, endFreq: 520, duration: 0.09, type: 'sine', volume: 0.04 });
      break;
    case 'send':
      playTone({ freq: 880, endFreq: 1100, duration: 0.06, type: 'triangle', volume: 0.048 });
      break;
    case 'record':
      playTone({ freq: 280, duration: 0.1, type: 'square', volume: 0.035 });
      break;
    case 'recordStop':
      playSequence([
        { freq: 320, duration: 0.05, volume: 0.035, type: 'square' },
        { freq: 240, at: 0.06, duration: 0.07, volume: 0.03, type: 'square' },
      ]);
      break;
    case 'leave':
      playTone({ freq: 330, endFreq: 220, duration: 0.12, type: 'triangle', volume: 0.05 });
      break;
    case 'success':
      playSequence([
        { freq: 523, duration: 0.05, volume: 0.045 },
        { freq: 659, at: 0.045, duration: 0.05, volume: 0.048 },
        { freq: 784, at: 0.09, duration: 0.08, volume: 0.05 },
      ]);
      break;
    case 'chatMessage':
      playSequence([
        { freq: 740, duration: 0.07, volume: 0.058, type: 'sine' },
        { freq: 988, at: 0.065, duration: 0.11, volume: 0.062, type: 'sine' },
      ]);
      break;
  }
}
