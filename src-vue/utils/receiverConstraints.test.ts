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

  it('returns empty selectedSources and zero lastN when none are visible yet', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['a', 'b'],
      visibleUserIds: [],
      stageIds: [],
    });
    expect(constraints?.selectedSources).toEqual([]);
    expect(constraints?.lastN).toBe(0);
  });

  it('only subscribes to visible and on-stage users, excluding off-screen remotes', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['a', 'b', 'c', 'd', 'e'],
      visibleUserIds: ['a'],
      stageIds: ['b'],
    });
    expect(constraints?.selectedSources).toEqual(['a-v0', 'a-v1', 'b-v0', 'b-v1']);
    expect(constraints?.constraints['c-v0']).toBeUndefined();
    expect(constraints?.constraints['c-v1']).toBeUndefined();
    expect(constraints?.constraints['d-v0']).toBeUndefined();
  });

  it('uses source IDs for selected and on-stage constraints', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['a', 'b'],
      visibleUserIds: ['a'],
      stageIds: ['b'],
    });
    expect(constraints?.selectedSources).toEqual(expect.arrayContaining(['a-v0', 'a-v1', 'b-v0', 'b-v1']));
    expect(constraints?.onStageSources).toEqual(['b-v0', 'b-v1']);
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
    expect(constraints?.constraints['a-v1']).toEqual({ maxHeight: 720 });
    expect(constraints?.constraints['b-v0']).toEqual({ maxHeight: 720 });
    expect(constraints?.constraints['b-v1']).toEqual({ maxHeight: 720 });
  });

  it('sets lastN to zero when no remotes are on screen or stage', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['peer'],
      visibleUserIds: [],
      stageIds: [],
    });
    expect(constraints?.lastN).toBe(0);
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
      expect(constraints?.lastN).toBe(40);
    });
  });
});
