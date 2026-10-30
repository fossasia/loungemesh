import { describe, expect, it, vi } from 'vitest';
import type { JitsiMeetJS, JitsiTrack } from '@/types/jitsi';
import {
  acquireDesktopTracks,
  desktopCaptureRequest,
  isMobileCaptureDevice,
  shouldShowRemoteShare,
} from './screenshareCapture';

describe('screenshareCapture', () => {
  it('uses a 720p desktop request and a looser phone request', () => {
    const desktop = desktopCaptureRequest(false);
    expect(desktop.desktopSharingSources).toEqual(['screen', 'window', 'tab']);
    const phone = desktopCaptureRequest(true);
    expect(phone.desktopSharingSources).toBeUndefined();
    expect(phone.devices).toEqual(['desktop']);
  });

  it('detects phones and coarse narrow screens', () => {
    expect(isMobileCaptureDevice()).toBe(false);
    expect(isMobileCaptureDevice('Mozilla/5.0 (iPhone)', 390, false)).toBe(true);
    expect(isMobileCaptureDevice('Mozilla/5.0', 800, true)).toBe(true);
    expect(isMobileCaptureDevice('Mozilla/5.0', 1200, true)).toBe(false);
    window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
    expect(isMobileCaptureDevice('Mozilla/5.0', 800)).toBe(false);
    window.matchMedia = vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia;
    expect(isMobileCaptureDevice('Mozilla/5.0', 800)).toBe(true);
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('keeps distant shares visible on a phone and for the presenter', () => {
    expect(shouldShowRemoteShare(900, false, 1024)).toBe(false);
    expect(shouldShowRemoteShare(100, false, 1024)).toBe(true);
    expect(shouldShowRemoteShare(900, true, 1024)).toBe(true);
    expect(shouldShowRemoteShare(900, false, 390)).toBe(true);
  });

  it('publishes a desktop capture and marks an unmarked video track', async () => {
    const unmarked = { getType: () => 'video' } as JitsiTrack;
    const desktop = { getType: () => 'video', videoType: 'desktop' } as JitsiTrack;
    const audio = { getType: () => 'audio' } as JitsiTrack;
    const jsMeet = {
      createLocalTracks: vi.fn().mockResolvedValue([audio, desktop, unmarked]),
    } as unknown as JitsiMeetJS;
    const tracks = await acquireDesktopTracks(jsMeet);
    expect(tracks).toHaveLength(3);
    expect(unmarked.videoType).toBe('desktop');
    expect(jsMeet.createLocalTracks).toHaveBeenCalledWith(
      expect.objectContaining({ devices: ['desktop'], firePermissionPromptIsShownEvent: true }),
    );
  });

  it('rethrows desktop capture failures on a computer', async () => {
    const jsMeet = {
      createLocalTracks: vi.fn().mockRejectedValue(new Error('denied')),
    } as unknown as JitsiMeetJS;
    await expect(acquireDesktopTracks(jsMeet, { mobile: false })).rejects.toThrow('denied');
  });

  it('falls back to getDisplayMedia on a phone', async () => {
    const created = { getType: () => 'video' } as JitsiTrack;
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const jsMeet = {
      createLocalTracks: vi.fn().mockRejectedValue(new Error('unsupported')),
      createLocalTracksFromMediaStreams: vi.fn().mockResolvedValue([created]),
    } as unknown as JitsiMeetJS;
    const tracks = await acquireDesktopTracks(jsMeet, {
      mobile: true,
      getDisplayMedia: () => Promise.resolve(stream),
    });
    expect(tracks[0].videoType).toBe('desktop');
    expect(jsMeet.createLocalTracksFromMediaStreams).toHaveBeenCalledWith([
      expect.objectContaining({ stream, videoType: 'desktop' }),
    ]);
  });

  it('stops the display stream when it cannot be wrapped', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia },
    });
    const jsMeet = {
      createLocalTracks: vi.fn().mockRejectedValue(new Error('unsupported')),
    } as unknown as JitsiMeetJS;
    await expect(acquireDesktopTracks(jsMeet, { mobile: true })).rejects.toThrow('unsupported');
    expect(getDisplayMedia).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
