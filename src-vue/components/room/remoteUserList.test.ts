import { describe, expect, it } from 'vitest';
import { buildRemoteUserList } from './remoteUserList';

describe('buildRemoteUserList', () => {
  it('maps conference users to list entries', () => {
    const list = buildRemoteUserList({
      a: {
        id: 'a',
        mute: true,
        volume: 1,
        pos: { x: 1, y: 2 },
        properties: {},
      },
      b: {
        id: 'b',
        mute: false,
        volume: 0.5,
        pos: { x: 3, y: 4 },
        properties: {},
      },
    });
    expect(list).toEqual([
      { id: 'a', x: 1, y: 2, displayName: 'Friendly Sphere', mute: true, hasVideo: false },
      { id: 'b', x: 3, y: 4, displayName: 'Friendly Sphere', mute: false, hasVideo: false },
    ]);
  });

  it('returns an empty list when there are no users', () => {
    expect(buildRemoteUserList({})).toEqual([]);
  });
});
