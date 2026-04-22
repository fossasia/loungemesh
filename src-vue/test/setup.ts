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

if (!globalThis.AudioContext) {
  class MockAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    createGain() {
      return {
        gain: { value: 1, setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }
  }
  // @ts-expect-error test shim
  globalThis.AudioContext = MockAudioContext;
}

Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 720, writable: true, configurable: true });

HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();

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
  trigger() {
    this.cb([], this as unknown as ResizeObserver);
  }
}
// @ts-expect-error test shim
globalThis.ResizeObserver = MockResizeObserver;

export function triggerLastResizeObserver() {
  (globalThis as { __lastResizeObserver?: MockResizeObserver }).__lastResizeObserver?.trigger();
}
