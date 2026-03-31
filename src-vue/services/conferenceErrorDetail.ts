/** Resolve a human-readable conference error from the Jitsi connection object. */
export function conferenceErrorDetail(xmpp: { lastErrorMsg?: string } | undefined): string {
  const msg = xmpp?.lastErrorMsg;
  return msg ? String(msg) : 'conference_error';
}
