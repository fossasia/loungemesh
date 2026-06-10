import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import {
  attachTrackToAudioElement,
  liveAudioTracks,
  mediaStreamForJitsiAudioPlayback,
  resolveRemoteAudioPlaybackStream,
  whenJitsiAudioPlaybackReady,
} from './jitsiTrackPlaybackStream';

describe('jitsiTrackPlaybackStream', () => {
  beforeEach(() => {
    vi.stubGlobal('JitsiMeetJS', {
      events: {
        track: {
          TRACK_STREAMING_STATUS_CHANGED: 'track.streamingStatusChanged',
          TRACK_MUTE_CHANGED: 'track.trackMuteChanged',
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('filters ended audio tracks from a stream', () => {
    const live = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const ended = { kind: 'audio', readyState: 'ended' } as MediaStreamTrack;
    const stream = {
      getAudioTracks: () => [live, ended],
    } as unknown as MediaStream;
    expect(liveAudioTracks(stream)).toEqual([live]);
  });

  it('returns undefined for empty live audio', () => {
    expect(liveAudioTracks(undefined)).toEqual([]);
    expect(mediaStreamForJitsiAudioPlayback(undefined)).toBeUndefined();
  });

  it('delegates mediaStreamForJitsiAudioPlayback to resolveRemoteAudioPlaybackStream', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const stream = mediaStreamForJitsiAudioPlayback({ track: audio } as never);
    expect(stream?.getAudioTracks()).toEqual([audio]);
  });

  it('exposes synthetic stream accessors when MediaStream is unavailable', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const OriginalMediaStream = globalThis.MediaStream;
    vi.stubGlobal('MediaStream', undefined);
    const stream = resolveRemoteAudioPlaybackStream({ track: audio } as never)!;
    expect(stream.getAudioTracks()).toEqual([audio]);
    expect(stream.getTracks()).toEqual([audio]);
    vi.stubGlobal('MediaStream', OriginalMediaStream);
  });

  it('prefers the sink srcObject after attach', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const stream = {
      getAudioTracks: () => [audio],
      getTracks: () => [audio],
    } as unknown as MediaStream;
    const el = document.createElement('audio');
    const track = {
      attach: vi.fn(() => {
        el.srcObject = stream;
      }),
      detach: vi.fn(),
    } as never;
    expect(resolveRemoteAudioPlaybackStream(track, el)).toBe(stream);
    expect(track.attach).toHaveBeenCalledWith(el);
  });

  it('reads audio from getStream, stream, and track.track', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const fromGetStream = {
      getAudioTracks: () => [audio],
    } as unknown as MediaStream;
    expect(
      resolveRemoteAudioPlaybackStream({
        getStream: () => fromGetStream,
      } as never),
    ).toBe(fromGetStream);

    const fromStreamProp = {
      getAudioTracks: () => [audio],
    } as unknown as MediaStream;
    expect(
      resolveRemoteAudioPlaybackStream({
        stream: fromStreamProp,
      } as never),
    ).toBe(fromStreamProp);

    const wrapped = resolveRemoteAudioPlaybackStream({ track: audio } as never);
    expect(liveAudioTracks(wrapped)).toEqual([audio]);
  });

  it('builds a synthetic stream when MediaStream is unavailable', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const OriginalMediaStream = globalThis.MediaStream;
    vi.stubGlobal('MediaStream', undefined);
    const stream = resolveRemoteAudioPlaybackStream({ track: audio } as never);
    expect(stream?.getAudioTracks()).toEqual([audio]);
    vi.stubGlobal('MediaStream', OriginalMediaStream);
  });

  it('ignores play() rejection after attach', async () => {
    const el = document.createElement('audio');
    el.play = vi.fn().mockReturnValue(Promise.reject(new Error('blocked')));
    attachTrackToAudioElement({ attach: vi.fn(), detach: vi.fn() } as never, el);
    await Promise.resolve();
    expect(el.play).toHaveBeenCalled();
  });

  it('tolerates detach and attach failures', () => {
    const el = document.createElement('audio');
    el.play = vi.fn().mockResolvedValue(undefined);
    const track = {
      detach: vi.fn(() => {
        throw new Error('detach');
      }),
      attach: vi.fn(() => {
        throw new Error('attach');
      }),
    } as never;
    expect(() => attachTrackToAudioElement(track, el)).not.toThrow();
  });

  it('calls onReady when the sink gains a stream', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const el = document.createElement('audio');
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const stop = whenJitsiAudioPlaybackReady(track, onReady, el);
    expect(onReady).not.toHaveBeenCalled();
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    el.srcObject = {
      getAudioTracks: () => [audio],
      getTracks: () => [audio],
    } as unknown as MediaStream;
    vi.advanceTimersByTime(100);
    expect(onReady).toHaveBeenCalledTimes(1);
    stop();
  });

  it('reacts to Jitsi track streaming and mute events', () => {
    const onReady = vi.fn();
    const handlers = new Map<string, (arg?: unknown) => void>();
    const track = {
      attach: vi.fn(),
      detach: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (arg?: unknown) => void) => {
        handlers.set(event, handler);
      }),
      removeEventListener: vi.fn(),
      getOriginalStream: vi.fn(() => undefined),
      track: { kind: 'audio', readyState: 'live' } as MediaStreamTrack,
    } as never;
    const stop = whenJitsiAudioPlaybackReady(track, onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
    onReady.mockClear();
    handlers.get('track.streamingStatusChanged')?.('interrupted');
    expect(onReady).not.toHaveBeenCalled();
    handlers.get('track.streamingStatusChanged')?.('active');
    expect(onReady).toHaveBeenCalled();
    handlers.get('track.trackMuteChanged')?.();
    expect(onReady.mock.calls.length).toBeGreaterThanOrEqual(2);
    handlers.get('track.streamingStatusChanged')?.('restoring');
    stop();
    expect(track.removeEventListener).toHaveBeenCalled();
  });

  it('wraps bare audio tracks with the MediaStream constructor when available', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const construct = vi.fn((tracks: MediaStreamTrack[]) => ({
      getAudioTracks: () => tracks,
      getTracks: () => tracks,
    }));
    class MockMediaStream {
      constructor(tracks: MediaStreamTrack[]) {
        construct(tracks);
      }
    }
    vi.stubGlobal('MediaStream', MockMediaStream);
    resolveRemoteAudioPlaybackStream({ track: audio } as never);
    expect(construct).toHaveBeenCalledWith([audio]);
  });

  it('handles restoring streaming status and stop without removeEventListener', () => {
    const onReady = vi.fn();
    const handlers = new Map<string, (arg?: unknown) => void>();
    const track = {
      attach: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (arg?: unknown) => void) => {
        handlers.set(event, handler);
      }),
      getOriginalStream: vi.fn(() => undefined),
      track: { kind: 'audio', readyState: 'live' } as MediaStreamTrack,
    } as never;
    const stop = whenJitsiAudioPlaybackReady(track, onReady);
    onReady.mockClear();
    handlers.get('track.streamingStatusChanged')?.('restoring');
    expect(onReady).toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('returns nullish streams from the lookup chain when they carry no audio', () => {
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const empty = { getAudioTracks: () => [] } as unknown as MediaStream;
    expect(
      resolveRemoteAudioPlaybackStream({
        getOriginalStream: () => empty,
        getStream: () => null,
        stream: undefined,
        track: audio,
      } as never)?.getAudioTracks(),
    ).toEqual([audio]);
  });

  it('stops polling after the attempt limit without a stream', () => {
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    const onReady = vi.fn();
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    whenJitsiAudioPlaybackReady(track, onReady);
    vi.advanceTimersByTime(5100);
    expect(onReady).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.stubGlobal('JitsiMeetJS', {
      events: {
        track: {
          TRACK_STREAMING_STATUS_CHANGED: 'track.streamingStatusChanged',
          TRACK_MUTE_CHANGED: 'track.trackMuteChanged',
        },
      },
    });
  });

  it('polls when Jitsi track events are not registered on JitsiMeetJS', () => {
    vi.stubGlobal('JitsiMeetJS', { events: { track: {} } });
    vi.useFakeTimers();
    const onReady = vi.fn();
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    const track = {
      attach: vi.fn(),
      detach: vi.fn(),
      getOriginalStream: vi.fn(() => undefined),
      track: audio,
    } as never;
    whenJitsiAudioPlaybackReady(track, onReady);
    expect(onReady).toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('polls without Jitsi track events when JitsiMeetJS is missing', () => {
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    const onReady = vi.fn();
    const el = document.createElement('audio');
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const stop = whenJitsiAudioPlaybackReady(track, onReady, el);
    const audio = { kind: 'audio', readyState: 'live' } as MediaStreamTrack;
    el.srcObject = {
      getAudioTracks: () => [audio],
    } as unknown as MediaStream;
    vi.advanceTimersByTime(100);
    expect(onReady).toHaveBeenCalled();
    stop();
  });
});
