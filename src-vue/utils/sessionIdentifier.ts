/** Normalized conference id from the session route param. */
export function sessionIdentifier(param: unknown): string {
  return String(param ?? '');
}
