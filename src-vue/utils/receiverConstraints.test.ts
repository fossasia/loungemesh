import { describe, expect, it } from 'vitest';
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

  it('never sets lastN to zero when remotes exist', () => {
    const constraints = buildReceiverConstraints({
      localId: 'me',
      remoteUserIds: ['peer'],
      visibleUserIds: [],
      stageIds: [],
    });
    expect(constraints?.lastN).toBe(1);
  });
});
