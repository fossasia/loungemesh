import { describe, expect, it } from 'vitest';
import { isAdmittedParticipant } from './lobbyAdmission';

describe('isAdmittedParticipant', () => {
  const base = { lobbyEnabled: true, hostId: 'host', lobbyApproved: {} as Record<string, boolean> };

  it('admits everyone when the lobby is off', () => {
    expect(isAdmittedParticipant({ ...base, lobbyEnabled: false }, 'guest')).toBe(true);
  });

  it('admits the host and approved people, and holds everyone else', () => {
    expect(isAdmittedParticipant(base, 'host')).toBe(true);
    expect(isAdmittedParticipant(base, 'guest')).toBe(false);
    expect(isAdmittedParticipant({ ...base, lobbyApproved: { guest: true } }, 'guest')).toBe(true);
    expect(isAdmittedParticipant({ ...base, hostId: '' }, 'guest')).toBe(false);
  });
});
