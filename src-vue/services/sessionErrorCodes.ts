export const SESSION_ERROR_CODES = {
  CONNECTION_FAILED: 'LM-E001',
  CONNECTION_LOST: 'LM-E002',
  JOIN_FAILED: 'LM-E003',
  SESSION_UNAVAILABLE: 'LM-E004',
  AUTH_FAILED: 'LM-E005',
  NETWORK: 'LM-E006',
  NOT_READY: 'LM-E007',
  UNKNOWN: 'LM-E008',
} as const;

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[keyof typeof SESSION_ERROR_CODES];

export type SessionErrorContext = 'connection' | 'conference' | 'join';

const CODE_PATTERN = /^LM-E\d{3}$/;

const USER_MESSAGES: Record<SessionErrorCode, string> = {
  [SESSION_ERROR_CODES.CONNECTION_FAILED]: "Couldn't connect to the session.",
  [SESSION_ERROR_CODES.CONNECTION_LOST]: 'The connection was lost.',
  [SESSION_ERROR_CODES.JOIN_FAILED]: "Couldn't join this session.",
  [SESSION_ERROR_CODES.SESSION_UNAVAILABLE]: 'This session is unavailable right now.',
  [SESSION_ERROR_CODES.AUTH_FAILED]: 'Sign-in expired or not allowed.',
  [SESSION_ERROR_CODES.NETWORK]: 'Check your network connection.',
  [SESSION_ERROR_CODES.NOT_READY]: "The session isn't ready yet.",
  [SESSION_ERROR_CODES.UNKNOWN]: 'Something went wrong.',
};

/** Internal detail for operators — see docs/guide/error-codes.md */
export const SESSION_ERROR_DETAILS: Record<SessionErrorCode, string> = {
  [SESSION_ERROR_CODES.CONNECTION_FAILED]:
    'XMPP/BOSH/WebSocket connection to Jitsi failed or timed out.',
  [SESSION_ERROR_CODES.CONNECTION_LOST]:
    'The client lost its connection to Jitsi after it was established.',
  [SESSION_ERROR_CODES.JOIN_FAILED]:
    'The room join step failed before the conference became active.',
  [SESSION_ERROR_CODES.SESSION_UNAVAILABLE]:
    'Jicofo, JVB, or the conference bridge rejected or could not start the room.',
  [SESSION_ERROR_CODES.AUTH_FAILED]:
    'JWT missing, expired, or rejected by the Jitsi secure domain.',
  [SESSION_ERROR_CODES.NETWORK]:
    'Browser is offline or could not reach LoungeMesh / Jitsi endpoints.',
  [SESSION_ERROR_CODES.NOT_READY]:
    'Join was attempted before the Jitsi connection was ready.',
  [SESSION_ERROR_CODES.UNKNOWN]: 'Unclassified session or connection failure.',
};

export function isSessionErrorCode(value: string): value is SessionErrorCode {
  return CODE_PATTERN.test(value.trim());
}

export function classifySessionError(
  detail: string,
  context?: SessionErrorContext,
): SessionErrorCode {
  const trimmed = detail.trim();
  if (!trimmed) return SESSION_ERROR_CODES.UNKNOWN;
  if (isSessionErrorCode(trimmed)) return trimmed;

  const d = trimmed.toLowerCase();

  if (/offline|network|failed to fetch|networkerror|econnrefused|enotfound|net::/.test(d)) {
    return SESSION_ERROR_CODES.NETWORK;
  }
  if (
    /not-authorized|not authorized|authentication|auth|token|forbidden|401|403|token_refresh_failed/.test(
      d,
    )
  ) {
    return SESSION_ERROR_CODES.AUTH_FAILED;
  }
  if (/not ready|connection is not ready/.test(d)) {
    return SESSION_ERROR_CODES.NOT_READY;
  }
  if (/focus|jicofo|conference_error|bridge|colibri|service-unavailable|unavailable/.test(d)) {
    return SESSION_ERROR_CODES.SESSION_UNAVAILABLE;
  }
  if (
    /disconnect|connection lost|disconnected|xml parsing|prefix not bound|not well-formed|namespace/.test(
      d,
    )
  ) {
    return SESSION_ERROR_CODES.CONNECTION_LOST;
  }
  if (context === 'join' || (/join|room join/.test(d) && !/connection failed/.test(d))) {
    return SESSION_ERROR_CODES.JOIN_FAILED;
  }
  if (
    context === 'connection' ||
    /connection failed|connection_failed|xmpp|websocket|bosh|strophe|public_url|jitsi/.test(d)
  ) {
    return SESSION_ERROR_CODES.CONNECTION_FAILED;
  }
  if (context === 'conference') return SESSION_ERROR_CODES.SESSION_UNAVAILABLE;
  return SESSION_ERROR_CODES.UNKNOWN;
}

export function normalizeSessionError(
  detail: string,
  context?: SessionErrorContext,
): SessionErrorCode {
  return classifySessionError(detail, context);
}

export function userMessageForCode(code: SessionErrorCode): string {
  return USER_MESSAGES[code];
}

export function formatUserFacingError(error: string): string {
  const code = normalizeSessionError(error);
  return `${userMessageForCode(code)} (${code})`;
}

export function shouldShowConferenceError(
  error: string | undefined,
  isJoined: boolean,
): boolean {
  if (!error?.trim()) return false;
  const code = normalizeSessionError(error, 'conference');
  if (isJoined && code === SESSION_ERROR_CODES.SESSION_UNAVAILABLE) return false;
  return true;
}
