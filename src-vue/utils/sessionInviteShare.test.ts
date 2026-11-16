import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import {
  buildSessionShareUrl,
  canNativeShareLink,
  copyMeetingShareLink,
  inviteAttendeesToSession,
  nativeShareMeetingLink,
  parseInviteEmails,
  syncEmailInputAriaInvalid,
} from './sessionInviteShare';

describe('sessionInviteShare', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('parses, normalizes, deduplicates, and validates email lists', () => {
    expect(parseInviteEmails('   ')).toEqual({ valid: [], invalid: [] });
    expect(
      parseInviteEmails('Alice@Example.com, bob@example.com; alice@example.com\nnot-an-email bad@host'),
    ).toEqual({
      valid: ['alice@example.com', 'bob@example.com'],
      invalid: ['not-an-email', 'bad@host'],
    });
  });

  it('builds canonical /session/:roomName share URLs', () => {
    expect(buildSessionShareUrl('team sync', 'https://meet.example.com///')).toBe(
      'https://meet.example.com/session/team%20sync',
    );
    expect(buildSessionShareUrl('   ', 'https://meet.example.com/')).toBe(
      'https://meet.example.com/session',
    );
    expect(buildSessionShareUrl('daily')).toContain('/session/daily');
  });

  it('copies share links via Clipboard API or textarea execCommand fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await expect(copyMeetingShareLink('https://meet.example.com/session/r1')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://meet.example.com/session/r1');

    // Clipboard throws -> fallback to execCommand('copy')
    writeText.mockRejectedValueOnce(new Error('denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    await expect(copyMeetingShareLink('https://meet.example.com/session/r2')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');

    // No clipboard and no execCommand -> returns false and cleans up textarea
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: undefined,
    });
    await expect(copyMeetingShareLink('https://meet.example.com/session/r3')).resolves.toBe(false);
  });

  it('handles Web Share API detection, sharing, cancellation, and errors', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    expect(canNativeShareLink()).toBe(false);
    await expect(nativeShareMeetingLink('room-a', 'https://x/session/room-a')).resolves.toBe(
      'unsupported',
    );

    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    expect(canNativeShareLink()).toBe(true);
    await expect(nativeShareMeetingLink('room-a', 'https://x/session/room-a')).resolves.toBe(
      'shared',
    );
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Join room-a on LoungeMesh',
      text: 'Join this LoungeMesh meeting:',
      url: 'https://x/session/room-a',
    });

    await expect(nativeShareMeetingLink('   ', 'https://x/session')).resolves.toBe('shared');
    expect(shareMock).toHaveBeenLastCalledWith({
      title: 'Join LoungeMesh meeting',
      text: 'Join this LoungeMesh meeting:',
      url: 'https://x/session',
    });

    const abortErr = new Error('User cancelled');
    abortErr.name = 'AbortError';
    shareMock.mockRejectedValueOnce(abortErr);
    await expect(nativeShareMeetingLink('room-a', 'https://x/session/room-a')).resolves.toBe(
      'cancelled',
    );

    shareMock.mockRejectedValueOnce(new Error('Share failed'));
    await expect(nativeShareMeetingLink('room-a', 'https://x/session/room-a')).resolves.toBe(
      'unsupported',
    );
  });

  it('syncs aria-invalid and fallback class with :user-invalid and checkValidity', () => {
    expect(() => syncEmailInputAriaInvalid(null)).not.toThrow();

    const input = document.createElement('input');
    input.type = 'email';
    input.required = true;

    syncEmailInputAriaInvalid(input, true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.classList.contains('user-invalid-fallback')).toBe(true);

    vi.spyOn(input, 'matches').mockReturnValueOnce(false);
    syncEmailInputAriaInvalid(input);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.classList.contains('user-invalid-fallback')).toBe(false);

    vi.spyOn(input, 'matches').mockImplementationOnce(() => {
      throw new DOMException('Unsupported selector');
    });
    input.value = '';
    syncEmailInputAriaInvalid(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('validates role & emails, broadcasts invites, auto-admits waiters, and persists via API', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    const engine = { sendCommand: vi.fn() };

    local.setMyID('guest-1');
    features.setHost('host-1');

    // Unauthorized caller
    const denied = await inviteAttendeesToSession('room-1', 'a@b.com', engine);
    expect(denied.ok).toBe(false);
    expect(denied.message).toContain('Only the host or a moderator');

    // Authorized moderator
    features.isVerifiedModerator = true;

    // Invalid email
    const bad = await inviteAttendeesToSession('room-1', 'invalid-email', engine);
    expect(bad.ok).toBe(false);
    expect(bad.invalid).toEqual(['invalid-email']);

    // Empty input
    const empty = await inviteAttendeesToSession('room-1', ' , ; ', engine);
    expect(empty.ok).toBe(false);
    expect(empty.message).toContain('Enter at least one');

    // Waiters: one with direct waiter.email, one via conference.users[id].email, one unrelated
    conference.addUser('w2');
    conference.users.w2.email = 'bob@example.com';
    conference.addUser('w3');
    features.lobbyWaiting = [
      { id: 'w1', name: 'Alice', email: 'alice@example.com' },
      { id: 'w2', name: 'Bob' },
      { id: 'w3', name: 'Unmatched' },
    ];
    features.hostEmail = 'host@example.com';

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        guestEmails: ['alice@example.com', 'server-extra@example.com'],
        emailSent: true,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const single = await inviteAttendeesToSession('room-1', 'Alice@Example.com', engine);
    expect(single.ok).toBe(true);
    expect(single.emailSent).toBe(true);
    expect(single.message).toBe('Invitation email sent to alice@example.com.');
    expect(features.guestEmails).toContain('alice@example.com');
    expect(features.guestEmails).toContain('server-extra@example.com');
    expect(features.lobbyApproved.w1).toBe(true);
    expect(features.lobbyWaiting.map((w) => w.id)).toEqual(['w2', 'w3']);
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'lobby',
      expect.stringContaining('"action":"invite"'),
    );
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'lobby',
      expect.stringContaining('"action":"approve"'),
    );

    // Multiple emails without controlEmail, API returns ok: true without guestEmails array
    features.hostEmail = '';
    features.lobbyWaiting.push({ id: 'w4', name: 'Carol', email: 'carol@example.com' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ emailSent: false }),
    });
    const multi = await inviteAttendeesToSession(
      'room-1',
      'bob@example.com, carol@example.com',
      engine,
    );
    expect(multi.ok).toBe(true);
    expect(multi.emailSent).toBe(false);
    expect(multi.message).toBe('Added 2 attendees to the invited list.');
    expect(features.lobbyApproved.w2).toBe(true);

    // Non-OK response and network rejection fall back cleanly
    fetchMock.mockResolvedValueOnce({ ok: false });
    const nonOk = await inviteAttendeesToSession('room-1', 'dave@example.com', engine);
    expect(nonOk.ok).toBe(true);

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const offline = await inviteAttendeesToSession('room-1', 'erin@example.com', engine);
    expect(offline.ok).toBe(true);

    // Blank room name skips fetch cleanly
    const noRoom = await inviteAttendeesToSession('   ', 'frank@example.com', engine);
    expect(noRoom.ok).toBe(true);
  });
});
