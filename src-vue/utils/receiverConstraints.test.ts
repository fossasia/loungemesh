import { afterEach, describe, expect, it } from 'vitest';
import { conferenceOptions } from '@/config/jitsiOptions';
import type { JitsiTrack } from '@/types/jitsi';
import { buildReceiverConstraints } from './receiverConstraints';

/** Minimal stand-in for a remote desktop track. */
function desktopTrack(sourceName?: string): JitsiTrack {
  return {
    videoType: 'desktop',
    ...(sourceName ? { getSourceName: () => sourceName } : {}),
  } as unknown as JitsiTrack;
}

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

  describe('screen shares', () => {
    it('requests the share source at full resolution, not tile resolution', () => {
      const constraints = buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: ['a', 'b'],
        visibleUserIds: ['a', 'b'],
        stageIds: [],
        screenshareTracks: { a: desktopTrack() },
      });
      // Without this the share falls through to defaultConstraints (360p) and
      // shared text is unreadable.
      expect(constraints?.constraints['a-v1']).toEqual({ maxHeight: 1080 });
      expect(constraints?.selectedSources).toContain('a-v1');
    });

    it('treats an active share as on-stage', () => {
      const constraints = buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: ['a'],
        visibleUserIds: ['a'],
        stageIds: [],
        screenshareTracks: { a: desktopTrack() },
      });
      expect(constraints?.onStageSources).toContain('a-v1');
    });

    it('prefers the source name reported by the track over the -v1 convention', () => {
      const constraints = buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: ['a'],
        visibleUserIds: ['a'],
        stageIds: [],
        screenshareTracks: { a: desktopTrack('a-v3') },
      });
      expect(constraints?.selectedSources).toContain('a-v3');
      expect(constraints?.constraints['a-v3']).toEqual({ maxHeight: 1080 });
    });

    it('budgets shares on top of channelLastN so a share cannot evict a camera', () => {
      const ids = Array.from({ length: 9 }, (_, i) => `u${i}`);
      const constraints = buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: ids,
        visibleUserIds: ids,
        stageIds: [],
        screenshareTracks: { u0: desktopTrack() },
      });
      // 9 cameras (the channelLastN cap) plus 1 share = 10 forwarded sources.
      // Capping at 9 is what made a tile or the share go black when sharing.
      expect(constraints?.lastN).toBe(10);
    });

    it('ignores shares from endpoints that are not remote participants', () => {
      const constraints = buildReceiverConstraints({
        localId: 'me',
        remoteUserIds: ['a'],
        visibleUserIds: ['a'],
        stageIds: [],
        screenshareTracks: { me: desktopTrack(), ghost: desktopTrack() },
      });
      expect(constraints?.selectedSources).not.toContain('me-v1');
      expect(constraints?.selectedSources).not.toContain('ghost-v1');
    });
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
