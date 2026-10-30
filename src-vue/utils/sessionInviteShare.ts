import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteAttendeesResult {
  ok: boolean;
  added: string[];
  invalid: string[];
  emailSent: boolean;
  message: string;
}

export function parseInviteEmails(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[,\s;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (EMAIL_PATTERN.test(normalized)) {
      valid.push(normalized);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}

export function buildSessionShareUrl(roomName: string, origin = window.location.origin): string {
  const cleanRoom = roomName.trim();
  const cleanOrigin = origin.replace(/\/+$/, '');
  return cleanRoom
    ? `${cleanOrigin}/session/${encodeURIComponent(cleanRoom)}`
    : `${cleanOrigin}/session`;
}

export async function copyMeetingShareLink(url: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fall back to execCommand copy below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } finally {
    textarea.remove();
  }
  return copied;
}

export function canNativeShareLink(): boolean {
  return typeof navigator.share === 'function';
}

export async function nativeShareMeetingLink(
  roomName: string,
  url: string,
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  try {
    await navigator.share({
      title: roomName.trim() ? `Join ${roomName.trim()} on LoungeMesh` : 'Join LoungeMesh meeting',
      text: 'Join this LoungeMesh meeting:',
      url,
    });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}

export function syncEmailInputAriaInvalid(
  el: HTMLInputElement | null,
  forceInvalid = false,
): void {
  if (!el) return;
  let invalid = forceInvalid;
  if (!invalid) {
    try {
      invalid = el.matches(':user-invalid');
    } catch {
      invalid = !el.checkValidity();
    }
  }
  el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  el.classList.toggle('user-invalid-fallback', invalid);
}

export async function inviteAttendeesToSession(
  roomName: string,
  rawEmails: string,
  engine: { sendCommand: (name: string, value: string) => void },
): Promise<InviteAttendeesResult> {
  const features = useSessionFeaturesStore();
  if (!features.isHost && !features.isModerator) {
    return {
      ok: false,
      added: [],
      invalid: [],
      emailSent: false,
      message: 'Only the host or a moderator can invite attendees.',
    };
  }

  const { valid, invalid } = parseInviteEmails(rawEmails);
  if (invalid.length > 0) {
    return {
      ok: false,
      added: [],
      invalid,
      emailSent: false,
      message: `Invalid email address: ${invalid.join(', ')}`,
    };
  }
  if (valid.length === 0) {
    return {
      ok: false,
      added: [],
      invalid: [],
      emailSent: false,
      message: 'Enter at least one attendee email address.',
    };
  }

  const conference = useConferenceStore();
  const added = features.addInvitedEmails(valid);
  const email = features.controlEmail();

  engine.sendCommand(
    'lobby',
    JSON.stringify({
      action: 'invite',
      emails: valid,
      ...(email ? { email } : {}),
    }),
  );

  const validSet = new Set(valid);
  for (const waiter of [...features.lobbyWaiting]) {
    const waiterEmail = (waiter.email || conference.users[waiter.id]?.email || '')
      .trim()
      .toLowerCase();
    if (waiterEmail && validSet.has(waiterEmail)) {
      engine.sendCommand(
        'lobby',
        JSON.stringify({ action: 'approve', id: waiter.id, ...(email ? { email } : {}) }),
      );
      features.approveLobby(waiter.id);
    }
  }

  let emailSent = false;
  const cleanRoom = roomName.trim();
  if (cleanRoom) {
    try {
      const res = await fetch(`/api/meetings/state/${encodeURIComponent(cleanRoom)}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: valid }),
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          guestEmails?: string[];
          emailSent?: boolean;
        };
        if (Array.isArray(payload.guestEmails)) {
          features.addInvitedEmails(payload.guestEmails);
        }
        emailSent = Boolean(payload.emailSent);
      }
    } catch {
      // In-room XMPP invite already applied; degrade gracefully if backend is unreachable.
    }
  }

  const countLabel = valid.length === 1 ? valid[0] : `${valid.length} attendees`;
  const message = emailSent
    ? `Invitation email sent to ${countLabel}.`
    : `Added ${countLabel} to the invited list.`;

  return {
    ok: true,
    added,
    invalid: [],
    emailSent,
    message,
  };
}

