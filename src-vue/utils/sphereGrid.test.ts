import { describe, expect, it } from 'vitest';
import { isInHearingSphere, sphereGridMembers } from './sphereGrid';

describe('sphereGrid', () => {
  const origin = { x: 0, y: 0 };

  it('includes nearby people and excludes those outside the audio radius', () => {
    expect(isInHearingSphere(origin, { id: 'near', pos: { x: 10, y: 10 } })).toBe(true);
    expect(isInHearingSphere(origin, { id: 'far', pos: { x: 2000, y: 2000 } })).toBe(false);
  });

  it('includes megaphone and stage occupants even when far', () => {
    expect(
      isInHearingSphere(origin, {
        id: 'loud',
        pos: { x: 2000, y: 2000 },
        properties: { megaphone: true },
      }),
    ).toBe(true);
    expect(
      isInHearingSphere(origin, { id: 'stage', pos: { x: 2000, y: 2000 } }, { presenterId: 'stage' }),
    ).toBe(true);
  });

  it('always lists the local user first plus in-sphere remotes', () => {
    const members = sphereGridMembers(
      origin,
      'me',
      'Ada',
      [
        { id: 'near', pos: { x: 5, y: 5 }, displayName: 'Near' },
        { id: 'far', pos: { x: 3000, y: 3000 }, displayName: 'Far' },
        { id: 'anon', pos: { x: 8, y: 8 } },
      ],
    );
    expect(members[0]).toEqual({ id: 'me', displayName: 'Ada', isLocal: true });
    expect(members.map((m) => m.id)).toEqual(['me', 'near', 'anon']);
    expect(members.find((m) => m.id === 'anon')?.displayName).toBe('Participant');
  });

  it('falls back to local id and You when identity is empty', () => {
    const members = sphereGridMembers(origin, '', '', []);
    expect(members).toEqual([{ id: 'local', displayName: 'You', isLocal: true }]);
  });
});
