import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { playUiSound, resetUiSoundsForTests, type UiSoundId } from './uiSounds';

describe('playUiSound', () => {
  beforeEach(() => {
    resetUiSoundsForTests();
    localStorage.removeItem('flowspace:ui-sounds');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetUiSoundsForTests();
  });

  it('plays every sound without throwing', () => {
    const ids: UiSoundId[] = [
      'tap',
      'toggleOn',
      'toggleOff',
      'handRaise',
      'handLower',
      'reaction',
      'panel',
      'send',
      'record',
      'recordStop',
      'leave',
      'success',
      'chatMessage',
    ];
    for (const id of ids) {
      expect(() => playUiSound(id)).not.toThrow();
    }
  });

  it('no-ops when ui sounds are disabled', () => {
    localStorage.setItem('flowspace:ui-sounds', '0');
    const AudioContextCtor = vi.fn();
    vi.stubGlobal('AudioContext', AudioContextCtor);
    playUiSound('tap');
    expect(AudioContextCtor).not.toHaveBeenCalled();
  });

  it('reuses a suspended AudioContext', () => {
    const resume = vi.fn();
    class MockCtx {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      resume = resume;
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      }));
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
    }
    vi.stubGlobal('AudioContext', MockCtx);
    playUiSound('tap');
    playUiSound('handRaise');
    expect(resume).toHaveBeenCalled();
  });

  it('returns quietly when AudioContext cannot be created', () => {
    vi.stubGlobal('AudioContext', vi.fn(() => {
      throw new Error('blocked');
    }));
    expect(() => playUiSound('tap')).not.toThrow();
  });

  it('recreates a closed AudioContext', async () => {
    vi.resetModules();
    let n = 0;
    class ClosingCtx {
      state: AudioContextState;
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      close = vi.fn();
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      }));
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      constructor() {
        this.state = n === 0 ? 'closed' : 'running';
        n += 1;
      }
    }
    vi.stubGlobal('AudioContext', ClosingCtx);
    const { playUiSound, resetUiSoundsForTests } = await import('./uiSounds');
    resetUiSoundsForTests();
    playUiSound('tap');
    playUiSound('tap');
    expect(n).toBe(2);
  });
});
