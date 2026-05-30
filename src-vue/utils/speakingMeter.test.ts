import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { makeTrack } from '@/test/makeTrack';

describe('watchTrackSpeaking', () => {
  let rafCb: FrameRequestCallback | null = null;
  let watchTrackSpeaking: typeof import('./speakingMeter').watchTrackSpeaking;

  beforeEach(async () => {
    vi.resetModules();
    const { resetMediaPlaybackUnlockForTests, installMediaPlaybackUnlock } = await import(
      './resumeMediaPlayback'
    );
    resetMediaPlaybackUnlockForTests();
    installMediaPlaybackUnlock({ resumePlayback: vi.fn() } as never);
    window.dispatchEvent(new PointerEvent('pointerdown'));
    ({ watchTrackSpeaking } = await import('./speakingMeter'));

    rafCb = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function MockAudioContext(this: {
        state: string;
        createMediaStreamSource: ReturnType<typeof vi.fn>;
        createAnalyser: ReturnType<typeof vi.fn>;
        resume: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
      }) {
        this.state = 'suspended';
        this.resume = vi.fn();
        this.close = vi.fn();
        this.createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
        this.createAnalyser = vi.fn(() => ({
          fftSize: 0,
          smoothingTimeConstant: 0,
          frequencyBinCount: 4,
          connect: vi.fn(),
          getByteFrequencyData: vi.fn((buf: Uint8Array) => {
            buf.fill(80);
          }),
        }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function trackWithStream(muted = false) {
    const track = makeTrack('audio');
    track.isMuted = () => muted;
    track.getOriginalStream = () =>
      ({
        getAudioTracks: () => [{ id: 'a1' }],
      }) as unknown as MediaStream;
    return track;
  }

  it('uses hysteresis while already speaking', async () => {
    let level = 80;
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function MockAudioContext(this: {
        state: string;
        createMediaStreamSource: ReturnType<typeof vi.fn>;
        createAnalyser: ReturnType<typeof vi.fn>;
        resume: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
      }) {
        this.state = 'running';
        this.resume = vi.fn();
        this.close = vi.fn();
        this.createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
        this.createAnalyser = vi.fn(() => ({
          fftSize: 0,
          smoothingTimeConstant: 0,
          frequencyBinCount: 4,
          connect: vi.fn(),
          getByteFrequencyData: vi.fn((buf: Uint8Array) => {
            buf.fill(level);
          }),
        }));
      }),
    );
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(trackWithStream(), onChange);
    await flushPromises();
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(true);
    onChange.mockClear();
    level = 12;
    rafCb?.(0);
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('reports speaking when level exceeds threshold', async () => {
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(trackWithStream(), onChange);
    await flushPromises();
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(true);
    stop();
  });

  it('clears an active speaking state when muted', async () => {
    let muted = false;
    const track = trackWithStream(false);
    track.isMuted = () => muted;
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(track, onChange);
    await flushPromises();
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(true);
    onChange.mockClear();
    muted = true;
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(false);
    stop();
  });

  it('clears speaking while muted from the start', async () => {
    const onChange = vi.fn();
    const track = trackWithStream(true);
    const stop = watchTrackSpeaking(track, onChange);
    await flushPromises();
    rafCb?.(0);
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('treats missing isMuted as unmuted for speaking monitor', async () => {
    const onChange = vi.fn();
    const track = trackWithStream();
    delete (track as { isMuted?: () => boolean }).isMuted;
    const stop = watchTrackSpeaking(track, onChange);
    await flushPromises();
    rafCb?.(0);
    expect(onChange).toHaveBeenCalledWith(true);
    stop();
  });

  it('returns noop when stream is missing', () => {
    const track = makeTrack('audio');
    track.getOriginalStream = undefined;
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(track, onChange);
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('returns noop when stream lacks getAudioTracks', () => {
    const track = makeTrack('audio');
    track.getOriginalStream = () => ({}) as MediaStream;
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(track, onChange);
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('runs cleanup without throwing', async () => {
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(trackWithStream(), onChange);
    await flushPromises();
    rafCb?.(0);
    expect(() => stop()).not.toThrow();
  });

  it('ignores late frames after cleanup', async () => {
    const onChange = vi.fn();
    const stop = watchTrackSpeaking(trackWithStream(), onChange);
    await flushPromises();
    rafCb?.(0);
    onChange.mockClear();
    stop();
    onChange.mockClear();
    rafCb?.(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('watchTrackSpeaking before playback unlock', () => {
  it('skips setup when stopped before unlock resolves', async () => {
    vi.resetModules();
    let resolveUnlock: (() => void) | undefined;
    vi.doMock('./resumeMediaPlayback', () => ({
      whenPlaybackUnlocked: () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
        }),
    }));
    const { watchTrackSpeaking } = await import('./speakingMeter');
    const AudioContextCtor = vi.fn();
    vi.stubGlobal('AudioContext', AudioContextCtor);
    const track = makeTrack('audio');
    track.getOriginalStream = () =>
      ({
        getAudioTracks: () => [{ id: 'a1' }],
      }) as unknown as MediaStream;
    const stop = watchTrackSpeaking(track, vi.fn());
    stop();
    resolveUnlock?.();
    await flushPromises();
    expect(AudioContextCtor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.doUnmock('./resumeMediaPlayback');
  });
});
