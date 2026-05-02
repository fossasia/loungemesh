/** Extract display name from a Jitsi participant — never store the participant object in Pinia. */
export function displayNameFromParticipant(participant: unknown): string | undefined {
  if (!participant || typeof participant !== 'object') return undefined;
  const name = (participant as { _displayName?: string })._displayName?.trim();
  return name || undefined;
}

/** Keep only JSON-serializable property values (avoids Vue deep-proxy on Strophe/XML nodes). */
export function sanitizeParticipantProperties(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props || typeof props !== 'object') return out;
  for (const [key, value] of Object.entries(props)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return out;
}
