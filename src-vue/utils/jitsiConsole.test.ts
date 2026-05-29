import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  installBenignJitsiConsoleFilter,
  installPreGestureAudioContextShim,
  resetJitsiConsoleFilterForTests,
  resetPreGestureAudioContextShimForTests,
  unlockAudioContextConstructor,
  withStubAudioContextDuringInit,
} from './jitsiConsole';

describe('jitsiConsole', () => {
  beforeEach(() => {
    resetJitsiConsoleFilterForTests();
    resetPreGestureAudioContextShimForTests();
    delete (window as { __flowspaceJitsiConsoleFilter?: boolean }).__flowspaceJitsiConsoleFilter;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetPreGestureAudioContextShimForTests();
  });

  it('filters lib-jitsi debug logs used by Firefox', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'false');
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    installBenignJitsiConsoleFilter();
    console.debug(
      '2026-06-01T10:04:09.243Z [DEBUG] [rtc:JitsiRemoteTrack] New remote track created',
    );
    console.debug('app debug');
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0]?.[0]).toBe('app debug');
  });

  it('filters lib-jitsi info logs and trace output', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'false');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const trace = vi.spyOn(console, 'trace').mockImplementation(() => {});
    installBenignJitsiConsoleFilter();
    console.log('2026-06-01T08:02:41.930Z [INFO] [core:JitsiMeetJS] This appears to be firefox');
    console.trace('2026-06-01T08:02:41.950Z [TRACE] [xmpp:strophe.util] Strophe 0 Websocket open');
    console.log('[flowspace:media] pipeline ok');
    console.trace('app trace');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toBe('[flowspace:media] pipeline ok');
    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace.mock.calls[0]?.[0]).toBe('app trace');
  });

  it('reuses bootstrap console originals when present', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'false');
    const trace = vi.fn();
    window.__flowspaceConsoleOriginals = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace,
    };
    installBenignJitsiConsoleFilter();
    console.warn('2026-06-01T08:02:41.931Z [WARN] [core:JitsiMeetJS] Analytics disabled, disposing.');
    console.error('real failure');
    expect(trace).not.toHaveBeenCalled();
    expect(window.__flowspaceConsoleOriginals?.error).toHaveBeenCalledWith('real failure');
  });

  it('filters benign websocket and AudioContext console noise on all levels', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'false');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installBenignJitsiConsoleFilter();
    console.log('[ERROR] [xmpp:strophe.util] Strophe: Websocket closed unexcectedly');
    console.error('[rtc:BridgeChannel] Channel closed: undefined undefined');
    console.warn('AudioContext was prevented from starting automatically');
    console.error('real failure');
    const circular: { self?: unknown } = {};
    circular.self = circular;
    console.error(circular);
    console.error(new Error('boom'));
    installBenignJitsiConsoleFilter();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(3);
    expect(error.mock.calls[0]?.[0]).toBe('real failure');
    expect(error.mock.calls[1]?.[0]).toBe(circular);
    expect(error.mock.calls[2]?.[0]).toBeInstanceOf(Error);
  });

  it('skips installing when bootstrap already patched console at current version', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'false');
    (window as { __flowspaceJitsiConsoleFilter?: boolean }).__flowspaceJitsiConsoleFilter = true;
    window.__flowspaceJitsiConsoleFilterVersion = 3;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    installBenignJitsiConsoleFilter();
    console.log('2026-06-01T08:02:41.930Z [INFO] [core:JitsiMeetJS] noisy');
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('does not filter console output when media debug is enabled', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    installBenignJitsiConsoleFilter();
    console.error('Websocket closed unexpectedly');
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('forwards lib-jitsi logs after media debug is turned on post-install', () => {
    vi.stubEnv('VITE_MEDIA_DEBUG', 'false');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    installBenignJitsiConsoleFilter();
    vi.stubEnv('VITE_MEDIA_DEBUG', 'true');
    console.log('2026-06-01T08:02:41.930Z [INFO] [core:JitsiMeetJS] noisy');
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('uses a stub AudioContext only during init', () => {
    class RealAudioContext {
      state = 'running';
    }
    vi.stubGlobal('AudioContext', RealAudioContext as unknown as typeof AudioContext);
    const created: Array<{
      suspend: () => Promise<void>;
      resume: () => Promise<void>;
      close: () => Promise<void>;
      createMediaStreamSource: () => { connect: () => void };
      createAnalyser: () => { connect: () => void; getByteFrequencyData: () => void };
      createGain: () => { connect: () => void; gain: { setTargetAtTime: () => void } };
      destination: object;
    }> = [];
    withStubAudioContextDuringInit(() => {
      const ctx = new AudioContext() as unknown as (typeof created)[number];
      created.push(ctx);
      void ctx.suspend();
      void ctx.resume();
      void ctx.close();
      ctx.createMediaStreamSource().connect({});
      ctx.createAnalyser().connect({});
      ctx.createAnalyser().getByteFrequencyData();
      ctx.createGain().connect({});
      ctx.createGain().gain.setTargetAtTime(1, 0, 0);
      const source = ctx.createMediaStreamSource() as { connect: () => void; disconnect: () => void };
      source.connect();
      source.disconnect();
      const analyser = ctx.createAnalyser() as { connect: () => void; disconnect: () => void };
      analyser.connect();
      analyser.disconnect();
      const gain = ctx.createGain() as {
        connect: () => void;
        disconnect: () => void;
        gain: { setTargetAtTime: () => void };
      };
      gain.connect();
      gain.disconnect();
      expect(ctx.destination).toBeTruthy();
    });
    expect(created[0]).toBeInstanceOf(Object);
    expect(created[0]).not.toBeInstanceOf(RealAudioContext);
    expect(new AudioContext()).toBeInstanceOf(RealAudioContext);
  });

  it('keeps a pre-gesture shim until unlock restores the real constructor', () => {
    class RealAudioContext {
      state = 'running';
    }
    vi.stubGlobal('AudioContext', RealAudioContext as unknown as typeof AudioContext);
    installPreGestureAudioContextShim();
    expect(new AudioContext()).not.toBeInstanceOf(RealAudioContext);
    unlockAudioContextConstructor();
    expect(new AudioContext()).toBeInstanceOf(RealAudioContext);
    installPreGestureAudioContextShim();
    expect(new AudioContext()).toBeInstanceOf(RealAudioContext);
  });

  it('patches webkitAudioContext when present', () => {
    class RealAudioContext {
      state = 'running';
    }
    vi.stubGlobal('AudioContext', RealAudioContext as unknown as typeof AudioContext);
    vi.stubGlobal('webkitAudioContext', RealAudioContext as unknown as typeof AudioContext);
    installPreGestureAudioContextShim();
    expect(new webkitAudioContext()).not.toBeInstanceOf(RealAudioContext);
    unlockAudioContextConstructor();
    expect(new webkitAudioContext()).toBeInstanceOf(RealAudioContext);
  });

  it('runs init callback directly when the pre-gesture shim is already active', () => {
    class RealAudioContext {
      state = 'running';
    }
    vi.stubGlobal('AudioContext', RealAudioContext as unknown as typeof AudioContext);
    installPreGestureAudioContextShim();
    const result = withStubAudioContextDuringInit(() => 7);
    expect(result).toBe(7);
    expect(new AudioContext()).not.toBeInstanceOf(RealAudioContext);
  });

  it('no-ops when AudioContext is missing during pre-gesture install', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => installPreGestureAudioContextShim()).not.toThrow();
  });

  it('does not restore the constructor when unlock happens during init', () => {
    class RealAudioContext {
      state = 'running';
    }
    vi.stubGlobal('AudioContext', RealAudioContext as unknown as typeof AudioContext);
    withStubAudioContextDuringInit(() => {
      unlockAudioContextConstructor();
      return 'ok';
    });
    expect(new AudioContext()).toBeInstanceOf(RealAudioContext);
  });

  it('skips stub patching when audio is already unlocked', () => {
    resetPreGestureAudioContextShimForTests();
    class RealAudioContext {
      state = 'running';
    }
    vi.stubGlobal('AudioContext', RealAudioContext as unknown as typeof AudioContext);
    installPreGestureAudioContextShim();
    unlockAudioContextConstructor();
    withStubAudioContextDuringInit(() => {
      expect(new AudioContext()).toBeInstanceOf(RealAudioContext);
    });
    expect(new AudioContext()).toBeInstanceOf(RealAudioContext);
  });
});

describe('withStubAudioContextDuringInit without AudioContext', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the callback when AudioContext is unavailable', () => {
    expect(withStubAudioContextDuringInit(() => 42)).toBe(42);
  });
});

describe('resetJitsiConsoleFilterForTests without window', () => {
  it('does not throw when window is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    const { resetJitsiConsoleFilterForTests: reset } = await import('./jitsiConsole');
    expect(() => reset()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
