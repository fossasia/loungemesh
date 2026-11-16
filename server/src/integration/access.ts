import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { Capability, EventyayRole, isEventyayRole } from './roles.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'fallback-jwt-secret-for-dev');
export const ACCESS_COOKIE = 'lm_access';

export interface AccessClaims {
  sub: string;
  name: string;
  room: string; // LoungeMesh roomName (== jitsi room)
  role: EventyayRole;
  caps: Capability[];
}

declare global {
  namespace Express {
    interface Request {
      access?: AccessClaims;
    }
  }
}

export function signAccess(claims: AccessClaims, expiresInSeconds = 7200): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: expiresInSeconds, audience: 'lm-access' });
}

export function parseAccessSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next();
  try {
    const d = jwt.verify(token, JWT_SECRET, { audience: 'lm-access' }) as any;
    if (isEventyayRole(d.role) && Array.isArray(d.caps)) {
      req.access = { sub: d.sub, name: d.name, room: d.room, role: d.role, caps: d.caps };
    }
  } catch {
    /* expired or invalid: treated as no access session */
  }
  next();
}

/**
 * Guards a mutating meeting route by capability.
 *  - Eventyay-linked meets: the caller must hold a valid access session for this
 *    room that includes the capability. No first-joiner or anonymous bypass.
 *  - Standalone meets: unchanged behaviour for collaborative caps; settings-type
 *    caps (settings, moderate, poll_manage) are left to the existing controller
 *    host/moderator checks.
 */
import { redisClient } from '../config/redis.js';

export function requireCapability(cap: Capability, opts: { standaloneOpen?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const roomName = (req.params.roomName as string) || '';
    try {
      // 1. Check if the capability corresponds to a feature disabled by the host
      const featureMap: Record<string, string> = {
        whiteboard: 'whiteboard',
        notes: 'notes',
        poll_manage: 'poll',
      };
      const feature = featureMap[cap];
      if (feature && roomName) {
        try {
          let enabledFeatures: Record<string, boolean> | undefined;
          const raw = await redisClient.get(`meeting:state:${roomName}:access`);
          if (raw) {
            const access = JSON.parse(raw);
            enabledFeatures = access?.enabledFeatures;
          } else {
            const meetingConfig = await prisma.meeting.findUnique({
              where: { roomName },
              select: { configs: true },
            });
            if (meetingConfig?.configs?.roomDefaults) {
              try {
                const parsed = JSON.parse(meetingConfig.configs.roomDefaults);
                enabledFeatures = parsed?.enabledFeatures;
              } catch {}
            }
          }
          if (enabledFeatures && enabledFeatures[feature] === false) {
            return res.status(403).json({ error: 'feature_disabled', feature });
          }
        } catch (e) {
          console.warn('Error reading feature enablement cache:', e);
        }
      }

      const meeting = roomName
        ? await prisma.meeting.findUnique({ where: { roomName }, select: { eventyayEventSlug: true } })
        : null;
      if (meeting?.eventyayEventSlug) {
        const a = req.access;
        if (a && a.room === roomName && a.caps.includes(cap)) return next();
        return res.status(403).json({ error: 'forbidden', required: cap });
      }
      if (opts.standaloneOpen === false && !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    } catch (err) {
      console.error('requireCapability error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
