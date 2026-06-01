import { describe, expect, it } from 'vitest';
import { conferenceNameDefault, conferenceOptions, jitsiInitOptions } from './jitsiOptions';

describe('jitsiOptions', () => {
  it('exports loungemesh defaults', () => {
    expect(conferenceNameDefault).toBe('loungemesh');
    expect(conferenceOptions.channelLastN).toBe(16);
    expect(conferenceOptions.openBridgeChannel).toBe('datachannel');
    expect(conferenceOptions.p2p).toEqual({ enabled: false });
    expect(conferenceOptions.disableSimulcast).toBe(true);
    expect(jitsiInitOptions.disableAudioLevels).toBe(true);
    expect(jitsiInitOptions.enableWindowOnErrorHandler).toBe(false);
  });
});
