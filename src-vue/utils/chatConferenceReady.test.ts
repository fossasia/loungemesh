import { describe, expect, it } from 'vitest';
import { hasChatConference, isChatReady } from './chatConferenceReady';

describe('chatConferenceReady', () => {
  it('detects conference handles', () => {
    expect(hasChatConference(undefined, undefined)).toBe(false);
    expect(hasChatConference({}, undefined)).toBe(true);
    expect(hasChatConference(undefined, {})).toBe(true);
  });

  it('allows chat when joined or local id is known', () => {
    expect(isChatReady({}, undefined, true, false)).toBe(true);
    expect(isChatReady({}, {}, false, true)).toBe(true);
    expect(isChatReady({}, {}, false, false, 'me')).toBe(true);
    expect(isChatReady({}, {}, false, false)).toBe(false);
    expect(isChatReady(undefined, undefined, true, true)).toBe(false);
  });
});
