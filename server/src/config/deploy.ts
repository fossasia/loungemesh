import type { CookieOptions, Request } from 'express';

/** Public base URL of this LoungeMesh deployment (e.g. https://lounge.example.com). */
export function publicUrl(req?: Request): string {
  const configured = (process.env.LOUNGEMESH_PUBLIC_URL || process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const proto = (req?.headers['x-forwarded-proto'] as string) || req?.protocol || 'http';
  const host = req?.headers.host || 'localhost:8780';
  return `${proto}://${host}`;
}

/**
 * Cookie options that work behind a TLS-terminating proxy
 * and when LoungeMesh is embedded in an Eventyay iframe.
 */
export function cookieOptions(maxAgeMs: number): CookieOptions {
  const secure = publicUrl().startsWith('https://') || process.env.NODE_ENV === 'production';
  const configured = (process.env.COOKIE_SAMESITE || '').toLowerCase();
  let sameSite: 'lax' | 'strict' | 'none' = secure ? 'none' : 'lax';
  if (configured === 'lax' || configured === 'strict' || configured === 'none') sameSite = configured;
  if (sameSite === 'none' && !secure) sameSite = 'lax'; // browsers reject SameSite=None without Secure
  const opts: CookieOptions = { httpOnly: true, secure, sameSite, maxAge: maxAgeMs };
  const domain = (process.env.COOKIE_DOMAIN || '').trim();
  if (domain) opts.domain = domain;
  return opts;
}

export function eventyayOrigin(): string {
  return (process.env.EVENTYAY_ORIGIN || '').trim().replace(/\/$/, '');
}
