import jwt from 'jsonwebtoken';
import { EventyayRole, isEventyayRole } from './roles.js';

export interface EventyayGrant {
  jti: string;
  sub: string; // stable Eventyay user id, or "guest:<id>"
  name: string;
  avatar?: string;
  event: string; // event slug
  room: string; // eventyay room id
  jitsiRoom: string;
  role: EventyayRole;
  allowed: boolean;
  exp: number;
  pin?: string;
  singleUser?: boolean;
}

export class GrantError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Verify an Eventyay-signed access grant (HS256, shared service secret). */
export function verifyGrant(token: string, secret = process.env.EVENTYAY_SERVICE_SECRET || process.env.JWT_SECRET || ''): EventyayGrant {
  if (!secret) throw new GrantError('integration_not_configured');
  let payload: any;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'eventyay',
      audience: 'loungemesh',
    });
  } catch (err: any) {
    throw new GrantError(err?.name === 'TokenExpiredError' ? 'grant_expired' : 'grant_invalid');
  }
  if (
    !payload.jti ||
    !payload.sub ||
    !payload.event ||
    !payload.room ||
    !payload.jitsi_room ||
    !isEventyayRole(payload.role)
  ) {
    throw new GrantError('grant_invalid');
  }
  return {
    jti: String(payload.jti),
    sub: String(payload.sub),
    name: String(payload.name || 'Attendee'),
    avatar: payload.avatar ? String(payload.avatar) : undefined,
    event: String(payload.event),
    room: String(payload.room),
    jitsiRoom: String(payload.jitsi_room),
    role: payload.role,
    allowed: payload.allowed === true,
    exp: Number(payload.exp),
    pin: payload.pin ? String(payload.pin) : undefined,
    singleUser: payload.single_user !== false,
  };
}
