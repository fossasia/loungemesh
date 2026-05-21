import { afterEach, describe, expect, it } from 'vitest';
import { conferenceOptions } from '@/config/jitsiOptions';
import { buildReceiverConstraints } from './receiverConstraints';

describe('buildReceiverConstraints', () => {
  it('returns null when there are no remote participants', () => {
    expect(
      buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: [],
        visibleUserIds: [],
        stageIds: [],
      }),
    ).toBeNull();
  });

  it('subscribes to all remotes when none are visible yet', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['a', 'b'],
      visibleUserIds: [],
      stageIds: [],
    });
    expect(constraints?.selectedSources).toEqual(expect.arrayContaining(['a-v0', 'b-v0']));
    expect(constraints?.lastN).toBeGreaterThanOrEqual(1);
  });

  it('uses source IDs for selected and on-stage constraints', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['a', 'b'],
      visibleUserIds: ['a'],
      stageIds: ['b'],
    });
    expect(constraints?.selectedSources).toEqual(expect.arrayContaining(['a-v0', 'b-v0']));
    expect(constraints?.onStageSources).toEqual(['b-v0']);
  });

  it('requests every selected source in the per-source constraints map', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['a', 'b'],
      visibleUserIds: ['a'],
      stageIds: ['b'],
    });
    // Empty per-source constraints leave modern JVB forwarding nothing, so every
    // selected source must appear, with on-stage requested at a higher resolution.
    expect(constraints?.constraints['a-v0']).toEqual({ maxHeight: 360 });
    expect(constraints?.constraints['b-v0']).toEqual({ maxHeight: 720 });
  });

  it('never sets lastN to zero when remotes exist', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['peer'],
      visibleUserIds: [],
      stageIds: [],
    });
    expect(constraints?.lastN).toBe(1);
  });

  describe('channelLastN fallback', () => {
    const original = conferenceOptions.channelLastN;
    afterEach(() => {
      conferenceOptions.channelLastN = original;
    });

    it('falls back to 20 when channelLastN is not a positive number', () => {
      conferenceOptions.channelLastN = 0 as never;
      const ids = Array.from({ length: 30 }, (_, i) => `u${i}`);
      const constraints = buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: ids,
        visibleUserIds: ids,
        stageIds: [],
      });
      expect(constraints?.lastN).toBe(20);
    });
  });
});
