import crypto from 'node:crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { cookieOptions } from '../config/deploy.js';
import { GrantError, verifyGrant } from './grant.js';
import { ACCESS_COOKIE, signAccess } from './access.js';
import { capabilitiesFor, resolveMaxParticipants } from './roles.js';
import { sha256 } from '../oauth/crypto.js';

const OCCUPANCY_TTL_MS = 90_000;
const SESSION_SECONDS = 7200;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Server-to-server calls from Eventyay must carry the shared service secret. */
export function requireServiceSecret(req: Request, res: Response, next: () => void) {
  const secret = process.env.EVENTYAY_SERVICE_SECRET || process.env.JWT_SECRET || '';
  const given = String(req.headers['x-service-secret'] || '');
  if (!secret || !given || !safeEqual(secret, given)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

/** Resolves the OAuth owner (linked LoungeMesh account) from a Bearer token. */
export async function requireOAuthOwner(req: Request, res: Response, next: () => void) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'invalid_token' });
  const row = await prisma.oAuthToken.findUnique({ where: { accessHash: sha256(auth.slice(7).trim()) } });
  if (!row || row.expiresAt < new Date()) return res.status(401).json({ error: 'invalid_token' });
  (req as any).oauthUserId = row.userId;
  next();
}

async function activeCount(room: string): Promise<number> {
  const key = `occupancy:${room}`;
  await redisClient.zRemRangeByScore(key, 0, Date.now() - OCCUPANCY_TTL_MS);
  return redisClient.zCard(key);
}

async function touch(room: string, sub: string) {
  const key = `occupancy:${room}`;
  await redisClient.zAdd(key, { score: Date.now(), value: sub });
  await redisClient.expire(key, 3600);
}

function issueJitsiJwt(name: string, room: string, moderator: boolean, avatar?: string): string | null {
  const secret = process.env.JITSI_APP_SECRET || '';
  if (!secret) return null;
  const appId = process.env.JITSI_APP_ID || 'loungemesh';
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      context: { user: { name, avatar: avatar || '', moderator } },
      aud: appId,
      iss: appId,
      sub: process.env.XMPP_DOMAIN || '*',
      room,
      nbf: now - 10,
    },
    secret,
    { algorithm: 'HS256', expiresIn: SESSION_SECONDS },
  );
}

/** POST /api/integration/exchange { grant } */
export async function exchangeGrant(req: Request, res: Response) {
  const raw = req.body?.grant;
  if (typeof raw !== 'string' || !raw.trim()) return res.status(400).json({ error: 'grant_required' });

  let grant;
  try {
    grant = verifyGrant(raw.trim());
  } catch (err) {
    const code = err instanceof GrantError ? err.code : 'grant_invalid';
    return res.status(code === 'integration_not_configured' ? 503 : 403).json({ error: code });
  }
  if (!grant.allowed) return res.status(403).json({ error: 'not_allowed' });

  try {
    let meeting = await prisma.meeting.findUnique({
      where: { roomName: grant.jitsiRoom },
      include: { configs: true },
    });
    if (!meeting) {
      let host = await prisma.user.findUnique({
        where: { email: 'integration@eventyay.com' },
      });
      if (!host) {
        host = await prisma.user.create({
          data: {
            email: 'integration@eventyay.com',
            displayName: 'Eventyay Integration',
          },
        });
      }
      meeting = await prisma.meeting.create({
        data: {
          title: `${grant.event} - Room ${grant.room}`,
          roomName: grant.jitsiRoom,
          hostId: host.id,
          maxParticipants: 50,
          guestLinkEnabled: true,
          joinPin: grant.pin ? String(grant.pin).trim() : null,
          eventyayEventSlug: grant.event,
          eventyayRoomId: grant.room,
          configs: {
            create: {
              roomDefaults: JSON.stringify({ notes: false, whiteboard: false, poll: false, moderator: false }),
              lobbyEnabled: false,
              joinPin: grant.pin ? String(grant.pin).trim() : null,
            },
          },
        },
        include: { configs: true },
      });
    } else if (meeting.eventyayEventSlug !== grant.event || meeting.eventyayRoomId !== grant.room) {
      return res.status(404).json({ error: 'meet_not_found' });
    }
    if (grant.role === 'guest' && !meeting.guestLinkEnabled) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    // Meeting PIN enforcement: Non-privileged participants must supply matching PIN if required
    const expectedPin = meeting.joinPin || grant.pin;
    const privileged = grant.role === 'host' || grant.role === 'moderator';
    if (expectedPin && !privileged) {
      const suppliedPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
      if (!suppliedPin) {
        return res.status(403).json({ error: 'pin_required', pin_required: true });
      }
      if (suppliedPin !== expectedPin.trim()) {
        return res.status(403).json({ error: 'invalid_pin', pin_required: true });
      }
    }

    // Capacity: host/moderator are exempt so organizers can never be locked out.
    const limit = resolveMaxParticipants(meeting.maxParticipants);
    const key = `occupancy:${grant.jitsiRoom}`;
    const alreadyIn = (await redisClient.zScore(key, grant.sub)) !== null;
    if (!privileged && !alreadyIn && (await activeCount(grant.jitsiRoom)) >= limit) {
      return res.status(409).json({ error: 'room_full', limit });
    }

    // Single-user unique attendee grant enforcement:
    // One-time use. A reload by the same participant reuses the access cookie instead of the grant.
    if (grant.singleUser) {
      try {
        await prisma.eventyayGrantUse.create({
          data: { jti: grant.jti, expiresAt: new Date(grant.exp * 1000) },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return res.status(409).json({
            error: 'single_user_replayed',
            message: 'This unique attendee link has already been used by another participant. Attendee links only allow one user.',
          });
        }
        throw err;
      }
    }

    let defaults = null;
    try {
      defaults = meeting.configs?.roomDefaults ? JSON.parse(meeting.configs.roomDefaults) : null;
    } catch {
      /* ignore malformed defaults */
    }
    const caps = capabilitiesFor(grant.role, defaults);
    await touch(grant.jitsiRoom, grant.sub);

    res.cookie(
      ACCESS_COOKIE,
      signAccess({ sub: grant.sub, name: grant.name, room: grant.jitsiRoom, role: grant.role, caps }, SESSION_SECONDS),
      cookieOptions(SESSION_SECONDS * 1000),
    );
    return res.json({
      status: 'granted',
      role: grant.role,
      capabilities: caps,
      display_name: grant.name,
      avatar: grant.avatar || '',
      jitsi_room: grant.jitsiRoom,
      jwt: issueJitsiJwt(grant.name, grant.jitsiRoom, privileged, grant.avatar),
      participant_id: grant.sub,
      max_participants: limit,
      expires_at: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
    });
  } catch (err) {
    console.error('exchangeGrant error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

/** GET /api/integration/session — current access claims (used on reload). */
export function currentSession(req: Request, res: Response) {
  if (!req.access) return res.status(401).json({ error: 'no_session' });
  return res.json({ role: req.access.role, capabilities: req.access.caps, room: req.access.room, name: req.access.name });
}

/** POST /api/integration/heartbeat — keeps the occupancy slot alive. */
export async function heartbeat(req: Request, res: Response) {
  if (!req.access) return res.status(401).json({ error: 'no_session' });
  await touch(req.access.room, req.access.sub);
  return res.json({ ok: true });
}

/** POST /api/integration/leave */
export async function leave(req: Request, res: Response) {
  if (req.access) await redisClient.zRem(`occupancy:${req.access.room}`, req.access.sub);
  res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
  return res.json({ ok: true });
}

/**
 * PUT /api/integration/meets (Eventyay server → LoungeMesh, service secret + owner Bearer token)
 * Creates or updates the meet for an Eventyay room, owned by the linked LoungeMesh account.
 */
export async function upsertMeet(req: Request, res: Response) {
  const ownerId = (req as any).oauthUserId as string;
  const { event, room, title, max_participants, guest_link_enabled, pin } = req.body || {};
  if (typeof event !== 'string' || !event || typeof room !== 'string' || !room || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'event_room_title_required' });
  }
  const roomName = `lms-${event}-${room}`;
  const maxParticipants = resolveMaxParticipants(Number(max_participants));
  const joinPin = typeof pin === 'string' && pin.trim() ? pin.trim() : (pin === '' ? null : undefined);
  try {
    const existing = await prisma.meeting.findUnique({ where: { roomName } });
    if (existing && existing.hostId !== ownerId) {
      return res.status(403).json({ error: 'meet_owned_by_other_account' });
    }
    const meeting = await prisma.meeting.upsert({
      where: { roomName },
      update: {
        title: title.trim(),
        maxParticipants,
        guestLinkEnabled: !!guest_link_enabled,
        ...(joinPin !== undefined ? { joinPin } : {}),
      },
      create: {
        title: title.trim(),
        roomName,
        hostId: ownerId,
        maxParticipants,
        guestLinkEnabled: !!guest_link_enabled,
        joinPin: joinPin ?? null,
        eventyayEventSlug: event,
        eventyayRoomId: room,
        configs: { create: { roomDefaults: JSON.stringify({ notes: false, whiteboard: false, poll: false, moderator: false }), lobbyEnabled: false, joinPin: joinPin ?? null } },
      },
    });
    return res.status(existing ? 200 : 201).json({
      id: meeting.id,
      room_name: meeting.roomName,
      title: meeting.title,
      max_participants: meeting.maxParticipants,
      max_participants_limit: resolveMaxParticipants(Number.MAX_SAFE_INTEGER),
      guest_link_enabled: meeting.guestLinkEnabled,
      join_pin: meeting.joinPin,
    });
  } catch (err) {
    console.error('upsertMeet error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

/** GET /api/public/meets/:event/:room — public, non-sensitive metadata. */
export async function publicMeet(req: Request, res: Response) {
  const roomName = `lms-${req.params.event}-${req.params.room}`;
  const meeting = await prisma.meeting.findUnique({ where: { roomName } });
  if (!meeting || !meeting.eventyayEventSlug) {
    return res.json({
      title: `${req.params.event} Room ${req.params.room}`,
      is_full: false,
      capacity: 50,
      current_participants: 0,
      hosts_count: 0,
      guest_link_enabled: false,
      pin_required: false,
    });
  }
  const limit = resolveMaxParticipants(meeting.maxParticipants);
  const count = await activeCount(roomName);
  return res.json({
    title: meeting.title,
    is_full: count >= limit,
    capacity: limit,
    current_participants: count,
    hosts_count: meeting.hostId ? 1 : 0,
    guest_link_enabled: false,
    pin_required: Boolean(meeting.joinPin),
  });
}
