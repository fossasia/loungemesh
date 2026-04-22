/** Resolve a human-readable conference error from the Jitsi connection object. */
export function conferenceErrorDetail(xmpp: { lastErrorMsg?: string } | undefined): string {
  const msg = xmpp?.lastErrorMsg?.trim();
  return msg ? String(msg) : '';
}

/** Whether a conference error banner should be shown to the user. */
export function shouldShowConferenceError(
  detail: string | undefined,
  isJoined: boolean,
): boolean {
  if (!detail?.trim()) return false;
  if (isJoined && detail === 'conference_error') return false;
  return true;
}
