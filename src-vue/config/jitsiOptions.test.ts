import { describe, expect, it } from 'vitest';
import { conferenceNameDefault, conferenceOptions } from './jitsiOptions';

describe('jitsiOptions', () => {
  it('exports flowspace defaults', () => {
    expect(conferenceNameDefault).toBe('flowspace');
    expect(conferenceOptions.channelLastN).toBe(3);
    expect(conferenceOptions.openBridgeChannel).toBe(false);
  });
});
