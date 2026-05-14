import { describe, expect, it } from 'vitest';
import { conferenceNameDefault, conferenceOptions } from './jitsiOptions';

describe('jitsiOptions', () => {
  it('exports flowspace defaults', () => {
    expect(conferenceNameDefault).toBe('flowspace');
    expect(conferenceOptions.channelLastN).toBe(16);
    expect(conferenceOptions.openBridgeChannel).toBe('datachannel');
    expect(conferenceOptions.p2p).toEqual({ enabled: false });
    expect(conferenceOptions.disableSimulcast).toBe(true);
  });
});
