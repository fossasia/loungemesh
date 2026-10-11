import { describe, expect, it } from 'vitest';
import { conferenceNameDefault, conferenceOptions, jitsiInitOptions } from './jitsiOptions';

describe('jitsiOptions', () => {
  it('exports loungemesh defaults', () => {
    expect(conferenceNameDefault).toBe('loungemesh');
    expect(conferenceOptions.channelLastN).toBe(9);
    expect(conferenceOptions.openBridgeChannel).toBe('datachannel');
    expect(conferenceOptions.p2p).toEqual({ enabled: false });
    expect(jitsiInitOptions.disableAudioLevels).toBe(true);
    expect(jitsiInitOptions.enableWindowOnErrorHandler).toBe(false);
  });

  it('keeps simulcast on so the bridge degrades per receiver, not per sender', () => {
    // With a single encoding JVB pushes the lowest receiver constraint back onto
    // the sender, so one small tile drags the stream down for everyone.
    expect(conferenceOptions.disableSimulcast).toBe(false);
    expect(conferenceOptions.enableLayerSuspension).toBe(true);
  });

  it('prefers VP9 over AV1 so long-haul links do not freeze tiles', () => {
    expect(conferenceOptions.videoQuality).toEqual({
      codecPreferenceOrder: ['VP9', 'VP8', 'H264', 'AV1'],
      mobileCodecPreferenceOrder: ['VP8', 'VP9', 'H264', 'AV1'],
    });
  });
});
