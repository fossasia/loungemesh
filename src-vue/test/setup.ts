import { afterEach, beforeEach, vi } from 'vitest';
import { config } from '@vue/test-utils';
import { resetMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { resetMediaEngineWiringForTests } from '@/composables/mediaEngineWiringState';
import { clearStoredAccess } from '@/composables/useAccessGuard';
import { cleanupJitsiTestContext, installJitsiTestContext } from './jitsiTestContext';

config.global.stubs = {
  teleport: true,
};

beforeEach(() => {
  installJitsiTestContext();
});

afterEach(() => {
  resetMediaEngineInstance();
  resetMediaEngineWiringForTests();
  cleanupJitsiTestContext();
  clearStoredAccess();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

if (!globalThis.AudioContext?.prototype?.createOscillator) {
  class MockAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    createGain() {
      return {
        gain: {
          value: 1,
          setTargetAtTime: vi.fn(),
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }
    createAnalyser() {
      return {
        fftSize: 512,
        smoothingTimeConstant: 0.65,
        frequencyBinCount: 256,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getByteFrequencyData: vi.fn(),
      };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
  }
  // @ts-expect-error test shim
  globalThis.AudioContext = MockAudioContext;
}

Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 720, writable: true, configurable: true });

HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();

// jsdom's play()/pause() only log "Not implemented" and return undefined. Stub silently
// so coverage paths stay the same as the real jsdom behavior.
HTMLMediaElement.prototype.play = function play() {
  return undefined as unknown as Promise<void>;
};
HTMLMediaElement.prototype.pause = function pause() {};

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

class MockResizeObserver {
  private readonly cb: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    (globalThis as { __lastResizeObserver?: MockResizeObserver }).__lastResizeObserver = this;
  }
  /** Trigger a resize notification (tests only). */
  trigger(width = 0) {
    const entries =
      width > 0
        ? [{ contentRect: { width, height: 0 } } as ResizeObserverEntry]
        : [];
    this.cb(entries, this as unknown as ResizeObserver);
  }
}
// @ts-expect-error test shim
globalThis.ResizeObserver = MockResizeObserver;

export function triggerLastResizeObserver(width?: number) {
  (globalThis as { __lastResizeObserver?: MockResizeObserver }).__lastResizeObserver?.trigger(
    width,
  );
}
