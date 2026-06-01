import { isMediaDebugEnabled } from '@/utils/mediaDebug';

let consoleFilterInstalled = false;

let realAudioContextCtor: typeof AudioContext | undefined;
let audioContextShimInstalled = false;
let audioContextUnlocked = false;

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';

type ConsoleOriginals = Record<ConsoleLevel, (...args: unknown[]) => void>;

declare global {
  interface Window {
    __loungemeshJitsiConsoleFilter?: boolean;
    __loungemeshJitsiConsoleFilterVersion?: number;
    __loungemeshConsoleOriginals?: ConsoleOriginals;
  }
}

const CONSOLE_FILTER_VERSION = 3;

const JITSI_LIBRARY_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[(INFO|DEBUG|TRACE|WARN|ERROR)\] \[/,
  /\[(xmpp|rtc|core|stats|qc|misc|videosipgw):[^\]]+\]/i,
  /websocket closed unexce?ctedly/i,
  /strophe:.*websocket closed/i,
  /\[rtc:BridgeChannel\]/i,
  /channel closed:/i,
  /AudioContext was prevented from starting automatically/i,
  /Analytics disabled, disposing/i,
  /Connecting audio context/i,
  /^Strophe \d+/i,
];

export function resetJitsiConsoleFilterForTests(): void {
  consoleFilterInstalled = false;
  if (typeof window !== 'undefined') {
    delete window.__loungemeshJitsiConsoleFilter;
    delete window.__loungemeshJitsiConsoleFilterVersion;
    delete window.__loungemeshConsoleOriginals;
  }
}

export function resetPreGestureAudioContextShimForTests(): void {
  if (realAudioContextCtor && audioContextShimInstalled) {
    window.AudioContext = realAudioContextCtor;
  }
  realAudioContextCtor = undefined;
  audioContextShimInstalled = false;
  audioContextUnlocked = false;
}

function argText(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function isLoungeMeshLog(text: string): boolean {
  return text.includes('[loungemesh:media]');
}

function shouldFilterConsoleArgs(args: unknown[]): boolean {
  if (isMediaDebugEnabled()) return false;
  const text = argText(args);
  if (isLoungeMeshLog(text)) return false;
  return JITSI_LIBRARY_PATTERNS.some((pattern) => pattern.test(text));
}

function ensureConsoleOriginals(): ConsoleOriginals {
  if (!window.__loungemeshConsoleOriginals) {
    window.__loungemeshConsoleOriginals = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      trace: console.trace.bind(console),
    };
  }
  return window.__loungemeshConsoleOriginals;
}

/** Hide lib-jitsi console noise unless media debug is on. */
export function installBenignJitsiConsoleFilter(): void {
  if (isMediaDebugEnabled()) return;
  if (
    window.__loungemeshJitsiConsoleFilterVersion === CONSOLE_FILTER_VERSION ||
    consoleFilterInstalled
  ) {
    consoleFilterInstalled = true;
    return;
  }
  consoleFilterInstalled = true;

  const originals = ensureConsoleOriginals();

  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    console[level] = ((...args: unknown[]) => {
      if (shouldFilterConsoleArgs(args)) return;
      originals[level](...args);
    }) as typeof console.error;
  }

  console.trace = ((...args: unknown[]) => {
    if (shouldFilterConsoleArgs(args)) return;
    originals.trace(...args);
  }) as typeof console.trace;

  window.__loungemeshJitsiConsoleFilter = true;
  window.__loungemeshJitsiConsoleFilterVersion = CONSOLE_FILTER_VERSION;
}

class StubAudioContext {
  readonly __loungemeshStub = true;
  state: AudioContextState = 'suspended';

  suspend(): Promise<void> {
    return Promise.resolve();
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  createMediaStreamSource(): AudioNode {
    return { connect: () => {}, disconnect: () => {} } as unknown as AudioNode;
  }

  createAnalyser(): AnalyserNode {
    return {
      connect: () => {},
      disconnect: () => {},
      fftSize: 512,
      frequencyBinCount: 256,
      getByteFrequencyData: () => {},
    } as unknown as AnalyserNode;
  }

  createGain(): GainNode {
    return {
      gain: { value: 1, setTargetAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
    } as unknown as GainNode;
  }

  get destination(): AudioDestinationNode {
    return {} as AudioDestinationNode;
  }
}

function patchAudioContextCtor(target: Window & typeof globalThis): void {
  const ctor = target.AudioContext;
  if (!ctor) return;
  realAudioContextCtor = ctor;
  target.AudioContext = StubAudioContext as unknown as typeof AudioContext;
  const webkit = (target as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (webkit) {
    (target as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext =
      StubAudioContext as unknown as typeof AudioContext;
  }
}

/** Prevent lib-jitsi LocalStatsCollector from hitting a real AudioContext before user gesture. */
export function installPreGestureAudioContextShim(): void {
  if (audioContextShimInstalled || audioContextUnlocked || typeof window === 'undefined') return;
  patchAudioContextCtor(window);
  audioContextShimInstalled = true;
}

export function unlockAudioContextConstructor(): void {
  if (audioContextUnlocked || !realAudioContextCtor || typeof window === 'undefined') return;
  audioContextUnlocked = true;
  window.AudioContext = realAudioContextCtor;
  const target = window as { webkitAudioContext?: typeof AudioContext };
  if (target.webkitAudioContext) {
    target.webkitAudioContext = realAudioContextCtor;
  }
}

export function isLoungeMeshStubAudioContext(ctx: unknown): boolean {
  return !!(ctx && typeof ctx === 'object' && '__loungemeshStub' in ctx);
}

/** Jitsi calls LocalStatsCollector.init() even when disableAudioLevels is true. */
export function withStubAudioContextDuringInit<T>(run: () => T): T {
  if (audioContextUnlocked) return run();
  if (audioContextShimInstalled) return run();
  if (!window.AudioContext) return run();

  patchAudioContextCtor(window);
  try {
    return run();
  } finally {
    if (!audioContextUnlocked && realAudioContextCtor) {
      window.AudioContext = realAudioContextCtor;
      audioContextShimInstalled = false;
      realAudioContextCtor = undefined;
    }
  }
}
