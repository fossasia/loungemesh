import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { decryptToken, encryptToken } from '../utils/crypto.js';
import { OAuth2Client } from 'google-auth-library';
import { sendMeetingInvitation } from '../utils/mailer.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = 'http://localhost:8780/api/auth/google/callback';

// Helper to get authorized Google Access Token
async function getGoogleAccessToken(userId: string, req?: Request): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleToken: true },
  });

  if (!user || !user.googleToken) return null;

  try {
    const tokens = JSON.parse(decryptToken(user.googleToken));
    if (!tokens.refresh_token) {
      // If no refresh token, we only have the access token which might expire
      return tokens.access_token || null;
    }

    let redirectUri = GOOGLE_REDIRECT_URI;
    if (req) {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = req.headers.host || 'localhost:8780';
      redirectUri = `${proto}://${host}/api/auth/google/callback`;
    }
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
    client.setCredentials(tokens);

    // GetAccessToken will auto-refresh if expired
    const response = await client.getAccessToken();
    const activeAccessToken = response.token;

    if (activeAccessToken && activeAccessToken !== tokens.access_token) {
      // Save refreshed tokens
      const updatedTokens = { ...tokens, access_token: activeAccessToken };
      await prisma.user.update({
        where: { id: userId },
        data: { googleToken: encryptToken(JSON.stringify(updatedTokens)) },
      });
    }

    return activeAccessToken || null;
  } catch (err) {
    console.error('Error refreshing Google token:', err);
    return null;
  }
}

// Helper: Sync Event to Google Calendar (Create or Update)
async function syncGoogleCalendarEvent(
  userId: string,
  meeting: { title: string; roomName: string; startTime: Date; endTime: Date; recurrence?: string | null; guestEmails?: string[]; moderatorEmails?: string[] },
  existingEventId?: string | null,
  req?: Request
): Promise<string | null> {
  const host = req?.headers.host || 'localhost:8780';
  const accessToken = await getGoogleAccessToken(userId, req);
  if (!accessToken) return null;

  const eventPayload: any = {
    summary: meeting.title,
    description: `Join LoungeMesh Spatial Meet: http://${host}/session/${meeting.roomName}`,
    start: {
      dateTime: meeting.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: meeting.endTime.toISOString(),
      timeZone: 'UTC',
    },
    recurrence: meeting.recurrence && meeting.recurrence !== 'NONE' 
      ? [`RRULE:FREQ=${meeting.recurrence}`] 
      : undefined,
  };

  const allEmails = [...(meeting.guestEmails || []), ...(meeting.moderatorEmails || [])];
  if (allEmails.length > 0) {
    eventPayload.attendees = allEmails.map(email => ({ email }));
  }

  try {
    const url = existingEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const method = existingEventId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${errText}`);
    }

    const eventData = (await response.json()) as { id: string };
    return eventData.id;
  } catch (err) {
    console.error('Failed to sync Google Calendar event:', err);
    return null;
  }
}

// Helper: Delete Event from Google Calendar
async function deleteGoogleCalendarEvent(userId: string, eventId: string, req?: Request) {
  const accessToken = await getGoogleAccessToken(userId, req);
  if (!accessToken) return;

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const errText = await response.text();
      console.error(`Google Calendar deletion failed: ${response.status} - ${errText}`);
    }
  } catch (err) {
    console.error('Error deleting Google Calendar event:', err);
  }
}

// ── Controllers ──────────────────────────────────────────────────────────────

export async function createMeeting(req: Request, res: Response) {
  const { 
    title, 
    roomName, 
    isScheduled, 
    startTime, 
    endTime, 
    recurrence, 
    syncGoogleCal, 
    guestEmails,
    moderatorEmails,
    lobbyEnabled,
    stagePromotionEnabled,
    allowParticipantRecording,
    roomDefaults
  } = req.body;

  if (!title || !roomName) {
    return res.status(400).json({ error: 'Title and roomName are required' });
  }

  const hostId = req.user!.id;
  const guests = Array.isArray(guestEmails) ? guestEmails : [];
  const moderators = Array.isArray(moderatorEmails) ? moderatorEmails : [];

  try {
    const existing = await prisma.meeting.findUnique({ where: { roomName } });
    if (existing) {
      return res.status(400).json({ error: 'Room name already in use' });
    }

    const start = startTime ? new Date(startTime) : null;
    const end = endTime ? new Date(endTime) : null;

    // Create the meeting and default configurations
    const meeting = await prisma.meeting.create({
      data: {
        title,
        roomName,
        isScheduled: !!isScheduled,
        startTime: start,
        endTime: end,
        recurrence: recurrence || 'NONE',
        guestEmails: guests,
        moderatorEmails: moderators,
        hostId,
        configs: {
          create: {
            lobbyEnabled: lobbyEnabled !== undefined ? !!lobbyEnabled : false,
            stagePromotionEnabled: stagePromotionEnabled !== undefined ? !!stagePromotionEnabled : true,
            allowParticipantRecording: allowParticipantRecording !== undefined ? !!allowParticipantRecording : false,
            roomDefaults: roomDefaults ? JSON.stringify(roomDefaults) : undefined,
          },
        },
      },
      include: {
        configs: true,
      },
    });

    // Sync to Google Calendar if requested
    if (isScheduled && start && end && syncGoogleCal) {
      const eventId = await syncGoogleCalendarEvent(hostId, {
        title,
        roomName,
        startTime: start,
        endTime: end,
        recurrence,
        guestEmails: guests,
        moderatorEmails: moderators,
      }, null, req);

      if (eventId) {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { googleEventId: eventId },
        });
        meeting.googleEventId = eventId;
      }
    }

    // Send SMTP invitation emails to guests if calendar sync was not completed
    if (isScheduled && start && end && guests.length > 0 && !meeting.googleEventId) {
      const hostUser = await prisma.user.findUnique({ where: { id: hostId } });
      await sendMeetingInvitation({
        title,
        roomName,
        startTime: start,
        endTime: end,
        recurrence: recurrence || 'NONE',
        guestEmails: guests,
        hostName: hostUser?.displayName || 'Host',
        hostEmail: hostUser?.email || 'noreply@loungemesh.com',
        hostHeader: req.headers.host || 'localhost:8780',
      });
    }

    // Cache meeting configuration in Redis
    if (meeting.configs) {
      const cacheKey = `meeting:config:${roomName}`;
      await redisClient.set(cacheKey, JSON.stringify(meeting.configs));
    }

    return res.status(201).json(meeting);
  } catch (err) {
    console.error('Create meeting error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUpcomingMeetings(req: Request, res: Response) {
  const hostId = req.user!.id;
  const email = req.user!.email;

  try {
    const meetings = await prisma.meeting.findMany({
      where: {
        isScheduled: true,
        AND: [
          {
            OR: [
              { hostId },
              { guestEmails: { has: email } },
              { moderatorEmails: { has: email } }
            ]
          },
          {
            OR: [
              { startTime: { gte: new Date() } },
              { recurrence: { not: 'NONE' } },
            ],
          }
        ]
      },
      include: {
        configs: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return res.json(meetings);
  } catch (err) {
    console.error('Get upcoming meetings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMeeting(req: Request, res: Response) {
  const id = req.params.id as string;
  const {
    title,
    startTime,
    endTime,
    recurrence,
    guestEmails,
    moderatorEmails,
    lobbyEnabled,
    stagePromotionEnabled,
    allowParticipantRecording,
    roomDefaults,
    syncGoogleCal
  } = req.body;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { configs: true },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    let isModerator = false;
    if (meeting.configs?.userGrants) {
      try {
        const grants = JSON.parse(meeting.configs.userGrants);
        if (grants[req.user!.id]?.moderator) {
          isModerator = true;
        }
      } catch (err) {
        console.error('Error parsing userGrants in updateMeeting:', err);
      }
    }

    if (meeting.hostId !== req.user!.id && !isModerator) {
      return res.status(403).json({ error: 'Forbidden: Only the host or moderators can modify this meeting' });
    }

    const start = startTime ? new Date(startTime) : meeting.startTime;
    const end = endTime ? new Date(endTime) : meeting.endTime;
    const rec = recurrence !== undefined ? recurrence : meeting.recurrence;
    const guests = Array.isArray(guestEmails) ? guestEmails : meeting.guestEmails;
    const moderators = Array.isArray(moderatorEmails) ? moderatorEmails : meeting.moderatorEmails;

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        title: title || meeting.title,
        startTime: start,
        endTime: end,
        recurrence: rec,
        guestEmails: guests,
        moderatorEmails: moderators,
        configs: {
          upsert: {
            update: {
              lobbyEnabled: lobbyEnabled !== undefined ? !!lobbyEnabled : undefined,
              stagePromotionEnabled: stagePromotionEnabled !== undefined ? !!stagePromotionEnabled : undefined,
              allowParticipantRecording: allowParticipantRecording !== undefined ? !!allowParticipantRecording : undefined,
              roomDefaults: roomDefaults ? JSON.stringify(roomDefaults) : undefined,
            },
            create: {
              lobbyEnabled: lobbyEnabled !== undefined ? !!lobbyEnabled : false,
              stagePromotionEnabled: stagePromotionEnabled !== undefined ? !!stagePromotionEnabled : true,
              allowParticipantRecording: allowParticipantRecording !== undefined ? !!allowParticipantRecording : false,
              roomDefaults: roomDefaults ? JSON.stringify(roomDefaults) : JSON.stringify({ notes: false, whiteboard: false, poll: false, moderator: false }),
            }
          }
        }
      },
    });

    // Invalidate Redis caches
    const cacheKeyConfig = `meeting:config:${meeting.roomName}`;
    const cacheKeyConfigState = `meeting:state:${meeting.roomName}:config`;
    const cacheKeyAccess = `meeting:state:${meeting.roomName}:access`;
    await redisClient.del(cacheKeyConfig);
    await redisClient.del(cacheKeyConfigState);
    await redisClient.del(cacheKeyAccess);

    // Sync updates to Google Calendar
    let finalGoogleEventId = updated.googleEventId;
    if (updated.isScheduled && start && end) {
      if (syncGoogleCal === true || (syncGoogleCal === undefined && meeting.googleEventId)) {
        const eventId = await syncGoogleCalendarEvent(
          meeting.hostId,
          {
            title: updated.title,
            roomName: updated.roomName,
            startTime: start,
            endTime: end,
            recurrence: rec,
            guestEmails: guests,
            moderatorEmails: moderators,
          },
          meeting.googleEventId,
          req
        );
        if (eventId && eventId !== meeting.googleEventId) {
          finalGoogleEventId = eventId;
          await prisma.meeting.update({
            where: { id },
            data: { googleEventId: eventId },
          });
        }
      } else if (syncGoogleCal === false && meeting.googleEventId) {
        await deleteGoogleCalendarEvent(meeting.hostId, meeting.googleEventId, req);
        finalGoogleEventId = null;
        await prisma.meeting.update({
          where: { id },
          data: { googleEventId: null },
        });
      }
    }

    // Send SMTP invitation updates to guests if calendar sync was not used
    const allInviteEmails = [...guests, ...moderators];
    if (updated.isScheduled && start && end && allInviteEmails.length > 0 && !finalGoogleEventId) {
      const hostUser = await prisma.user.findUnique({ where: { id: meeting.hostId } });
      await sendMeetingInvitation({
        title: updated.title,
        roomName: updated.roomName,
        startTime: start,
        endTime: end,
        recurrence: rec || 'NONE',
        guestEmails: allInviteEmails,
        hostName: hostUser?.displayName || 'Host',
        hostEmail: hostUser?.email || 'noreply@loungemesh.com',
        hostHeader: req.headers.host || 'localhost:8780',
      });
    }

    const resultMeeting = finalGoogleEventId !== updated.googleEventId
      ? { ...updated, googleEventId: finalGoogleEventId }
      : updated;
    return res.json(resultMeeting);
  } catch (err) {
    console.error('Update meeting error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function cancelMeeting(req: Request, res: Response) {
  const id = req.params.id as string;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { configs: true },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    let isModerator = false;
    if (meeting.configs?.userGrants) {
      try {
        const grants = JSON.parse(meeting.configs.userGrants);
        if (grants[req.user!.id]?.moderator) {
          isModerator = true;
        }
      } catch (err) {
        console.error('Error parsing userGrants in cancelMeeting:', err);
      }
    }

    if (meeting.hostId !== req.user!.id && !isModerator) {
      return res.status(403).json({ error: 'Forbidden: Only the host or moderators can cancel this meeting' });
    }

    // Delete from Google Calendar if synced
    if (meeting.googleEventId) {
      await deleteGoogleCalendarEvent(meeting.hostId, meeting.googleEventId, req);
    }

    // Clear configs cache
    await redisClient.del(`meeting:config:${meeting.roomName}`);

    // Delete from database
    await prisma.meeting.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Cancel meeting error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Meeting Configurations & Roles (Cashed via Redis) ───────────────────────

// Helper to determine role of a user in a meeting
async function getMeetingRoleForUser(roomName: string, userId?: string): Promise<'host' | 'moderator' | 'guest'> {
  if (!userId) return 'guest';
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    });
    if (!meeting) return 'guest';
    if (meeting.hostId === userId) return 'host';
    if (meeting.configs?.userGrants) {
      const grants = JSON.parse(meeting.configs.userGrants);
      if (grants[userId]?.moderator) {
        return 'moderator';
      }
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user && meeting.moderatorEmails.includes(user.email)) {
      return 'moderator';
    }
    return 'guest';
  } catch (err) {
    console.error('Error in getMeetingRoleForUser:', err);
    return 'guest';
  }
}

export async function getMeetingRole(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      select: { hostId: true }
    });
    const role = await getMeetingRoleForUser(roomName, req.user?.id);
    return res.json({ role, hostId: meeting?.hostId || null });
  } catch (err) {
    console.error('Get meeting role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


export async function getMeetingConfig(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:config:${roomName}`;

  try {
    // Check Redis config cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const meeting = (await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    })) as any;

    if (!meeting || !meeting.configs) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // Cache in Redis
    await redisClient.set(cacheKey, JSON.stringify(meeting.configs));

    return res.json(meeting.configs);
  } catch (err) {
    console.error('Get meeting config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMeetingConfig(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { lobbyEnabled, stagePromotionEnabled, allowParticipantRecording, notesTemplate } = req.body;

  try {
    const role = await getMeetingRoleForUser(roomName, req.user?.id);
    if (role !== 'host' && role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden: Only the host or a moderator can update config' });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const updatedConfig = await prisma.meetingConfig.upsert({
      where: { meetingId: meeting.id },
      update: {
        lobbyEnabled: lobbyEnabled !== undefined ? lobbyEnabled : undefined,
        stagePromotionEnabled: stagePromotionEnabled !== undefined ? stagePromotionEnabled : undefined,
        allowParticipantRecording: allowParticipantRecording !== undefined ? allowParticipantRecording : undefined,
        notesTemplate: notesTemplate !== undefined ? notesTemplate : undefined,
      },
      create: {
        meetingId: meeting.id,
        lobbyEnabled: !!lobbyEnabled,
        stagePromotionEnabled: stagePromotionEnabled !== undefined ? stagePromotionEnabled : true,
        allowParticipantRecording: !!allowParticipantRecording,
        notesTemplate: notesTemplate !== undefined ? notesTemplate : null,
      },
    });

    // Sync Redis cache
    const cacheKey = `meeting:config:${roomName}`;
    await redisClient.set(cacheKey, JSON.stringify(updatedConfig));

    return res.json(updatedConfig);
  } catch (err) {
    console.error('Update config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function addSessionLog(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { eventType, details } = req.body;

  try {
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const log = await prisma.sessionLog.create({
      data: {
        meetingId: meeting.id,
        eventType,
        details: details ? JSON.stringify(details) : null,
      },
    });

    return res.status(201).json(log);
  } catch (err) {
    console.error('Add session log error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getWhiteboardState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:whiteboard`;
  try {
    const rawStrokes = await redisClient.get(cacheKey);
    const strokes = rawStrokes ? JSON.parse(rawStrokes) : [];
    return res.json({ strokes });
  } catch (err) {
    console.error('Get whiteboard state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function addWhiteboardStroke(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { stroke } = req.body;
  if (!stroke) {
    return res.status(400).json({ error: 'Missing stroke payload' });
  }
  const cacheKey = `meeting:state:${roomName}:whiteboard`;
  try {
    const rawStrokes = await redisClient.get(cacheKey);
    const strokes = rawStrokes ? JSON.parse(rawStrokes) : [];
    strokes.push(stroke);
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(strokes));
    return res.json({ success: true });
  } catch (err) {
    console.error('Add whiteboard stroke error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function clearWhiteboardState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:whiteboard`;
  try {
    await redisClient.del(cacheKey);
    return res.json({ success: true });
  } catch (err) {
    console.error('Clear whiteboard state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getNotesState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:notes`;
  try {
    let notes = await redisClient.get(cacheKey);
    if (notes === null) {
      const meeting = await prisma.meeting.findUnique({
        where: { roomName },
        include: { configs: true },
      });
      notes = meeting?.configs?.sharedNotes || '';
      await redisClient.setEx(cacheKey, 86400, notes);
    }
    return res.json({ notes });
  } catch (err) {
    console.error('Get notes state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateNotesState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { notes } = req.body;
  if (notes === undefined) {
    return res.status(400).json({ error: 'Missing notes payload' });
  }
  const cacheKey = `meeting:state:${roomName}:notes`;
  try {
    await redisClient.setEx(cacheKey, 86400, notes);
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { sharedNotes: notes },
        create: { meetingId: meeting.id, sharedNotes: notes },
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Update notes state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAccessState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:access`;
  try {
    const raw = await redisClient.get(cacheKey);
    if (raw) {
      return res.json(JSON.parse(raw));
    }
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    });
    const defaults = meeting?.configs?.roomDefaults ? JSON.parse(meeting.configs.roomDefaults) : null;
    const grants = meeting?.configs?.userGrants ? JSON.parse(meeting.configs.userGrants) : {};
    const access = { defaults, grants };
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(access));
    return res.json(access);
  } catch (err) {
    console.error('Get access state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateAccessDefaults(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { defaults } = req.body;
  if (!defaults) {
    return res.status(400).json({ error: 'Missing defaults payload' });
  }
  try {
    const role = await getMeetingRoleForUser(roomName, req.user?.id);
    if (role !== 'host' && role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden: Only the host or a moderator can update access defaults' });
    }

    const cacheKey = `meeting:state:${roomName}:access`;
    const raw = await redisClient.get(cacheKey);
    const access = raw ? JSON.parse(raw) : { defaults: null, grants: {} };
    access.defaults = defaults;
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(access));
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { roomDefaults: JSON.stringify(defaults) },
        create: { meetingId: meeting.id, roomDefaults: JSON.stringify(defaults) },
      });
    }
    return res.json({ success: true, access });
  } catch (err) {
    console.error('Update access defaults error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateAccessGrants(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { userId, grants } = req.body;
  if (!userId || !grants) {
    return res.status(400).json({ error: 'Missing userId or grants payload' });
  }
  try {
    const role = await getMeetingRoleForUser(roomName, req.user?.id);
    if (role !== 'host' && role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden: Only the host or a moderator can update access grants' });
    }

    const cacheKey = `meeting:state:${roomName}:access`;
    let access;
    const raw = await redisClient.get(cacheKey);
    if (raw) {
      access = JSON.parse(raw);
    } else {
      const meeting = await prisma.meeting.findUnique({
        where: { roomName },
        include: { configs: true },
      });
      const defaults = meeting?.configs?.roomDefaults ? JSON.parse(meeting.configs.roomDefaults) : null;
      const grantsDb = meeting?.configs?.userGrants ? JSON.parse(meeting.configs.userGrants) : {};
      access = { defaults, grants: grantsDb };
    }
    access.grants = access.grants || {};
    access.grants[userId] = grants;
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(access));
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { userGrants: JSON.stringify(access.grants) },
        create: { meetingId: meeting.id, userGrants: JSON.stringify(access.grants) },
      });
    }
    return res.json({ success: true, access });
  } catch (err) {
    console.error('Update access grants error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getPollState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:poll`;
  try {
    const raw = await redisClient.get(cacheKey);
    if (raw) {
      return res.json({ poll: JSON.parse(raw) });
    }
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    });
    const poll = meeting?.configs?.activePoll ? JSON.parse(meeting.configs.activePoll) : null;
    if (poll) {
      await redisClient.setEx(cacheKey, 86400, JSON.stringify(poll));
    }
    return res.json({ poll });
  } catch (err) {
    console.error('Get poll state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updatePollState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { poll } = req.body;
  if (!poll) {
    return res.status(400).json({ error: 'Missing poll payload' });
  }
  const cacheKey = `meeting:state:${roomName}:poll`;
  try {
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(poll));
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { activePoll: JSON.stringify(poll) },
        create: { meetingId: meeting.id, activePoll: JSON.stringify(poll) },
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Update poll state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function clearPollState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:poll`;
  try {
    await redisClient.del(cacheKey);
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { activePoll: null },
        create: { meetingId: meeting.id, activePoll: null },
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Clear poll state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getBackgroundState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:background`;
  try {
    const gridBackgroundUrl = await redisClient.get(cacheKey) || '';
    return res.json({ gridBackgroundUrl });
  } catch (err) {
    console.error('Get background state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateBackgroundState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { gridBackgroundUrl } = req.body;
  if (gridBackgroundUrl === undefined) {
    return res.status(400).json({ error: 'Missing gridBackgroundUrl payload' });
  }
  const cacheKey = `meeting:state:${roomName}:background`;
  try {
    await redisClient.setEx(cacheKey, 86400, gridBackgroundUrl);
    return res.json({ success: true });
  } catch (err) {
    console.error('Update background state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function clearBackgroundState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:background`;
  try {
    await redisClient.del(cacheKey);
    return res.json({ success: true });
  } catch (err) {
    console.error('Clear background state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


