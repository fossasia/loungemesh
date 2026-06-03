/** Display label for a participant sphere, e.g. "Alex's Sphere". */
export function formatSphereName(username: string): string {
  const t = username.trim();
  if (!t) return 'Friendly Sphere';
  const stem = t.endsWith('s') || t.endsWith('S') ? `${t}'` : `${t}'s`;
  return `${stem} Sphere`;
}
