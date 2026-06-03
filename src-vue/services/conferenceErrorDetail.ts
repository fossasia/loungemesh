/** Resolve a conference error detail from the Jitsi connection object (internal logging). */
export function conferenceErrorDetail(xmpp: { lastErrorMsg?: string } | undefined): string {
  const msg = xmpp?.lastErrorMsg?.trim();
  return msg ? String(msg) : '';
}

export { shouldShowConferenceError } from './sessionErrorCodes';
