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
    expect(constraints?.selectedEndpoints).toEqual(expect.arrayContaining(['a', 'b']));
    expect(constraints?.lastN).toBeGreaterThanOrEqual(1);
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
