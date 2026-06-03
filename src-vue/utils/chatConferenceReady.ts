/** Whether the client has a Jitsi conference handle ready for chat. */
export function hasChatConference(
  storeConference: unknown,
  engineConference: unknown,
): boolean {
  return !!(storeConference || engineConference);
}

/** Whether chat send should be attempted (conference exists and local participant is known). */
export function isChatReady(
  storeConference: unknown,
  engineConference: unknown,
  storeJoined: boolean,
  engineJoined: boolean,
  localUserId?: string,
): boolean {
  if (!hasChatConference(storeConference, engineConference)) return false;
  if (storeJoined || engineJoined) return true;
  return !!localUserId;
}
