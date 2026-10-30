import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { decryptToken, encryptToken } from '../utils/crypto.js';
import { OAuth2Client } from 'google-auth-library';
import { sendMeetingInvitation } from '../utils/mailer.js';
import { LoungeMeshRole, normalizeRole } from '../integration/roles.js';

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

// Helper to convert simple Markdown to HTML for Google Calendar
function markdownToHtml(md: string): string {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br />');
}

// Helper: Sanitize meeting configuration to prevent exposing joinPin or internal fields
function lobbyFormValue(value: unknown): 'name' | 'details' {
  return value === 'details' ? 'details' : 'name';
}

function sanitizeMeetingConfig(configs: any) {
  if (!configs) return null;
  return {
    lobbyEnabled: !!configs.lobbyEnabled,
    lobbyForm: lobbyFormValue(configs.lobbyForm),
    stagePromotionEnabled: configs.stagePromotionEnabled !== undefined ? configs.stagePromotionEnabled : true,
    allowParticipantRecording: !!configs.allowParticipantRecording,
    notesTemplate: configs.notesTemplate || '',
  };
}

// Helper: Sync Event to Google Calendar (Create or Update)
async function syncGoogleCalendarEvent(
  userId: string,
  meeting: { title: string; description?: string | null; roomName: string; startTime: Date; endTime: Date; recurrence?: string | null; guestEmails?: string[]; moderatorEmails?: string[] },
  existingEventId?: string | null,
  req?: Request
): Promise<string | null> {
  const host = req?.headers.host || 'localhost:8780';
  const accessToken = await getGoogleAccessToken(userId, req);
  if (!accessToken) return null;

  const joinLinkHtml = `<p><strong>Join LoungeMesh Spatial Meet:</strong> <a href="http://${host}/session/${meeting.roomName}">http://${host}/session/${meeting.roomName}</a></p>`;
  const descHtml = meeting.description ? markdownToHtml(meeting.description) : '';
  const finalDescription = descHtml ? `${descHtml}<br /><br />${joinLinkHtml}` : joinLinkHtml;

  const eventPayload: any = {
    summary: meeting.title,
    description: finalDescription,
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
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}?sendUpdates=all`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all';

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
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
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
    attendeeEmails,
    moderatorEmails,
    lobbyEnabled,
    stagePromotionEnabled,
    allowParticipantRecording,
    roomDefaults,
    description,
    lobbyForm,
  } = req.body;

  if (!title || !roomName) {
    return res.status(400).json({ error: 'Title and roomName are required' });
  }

  const hostId = req.user?.id;
  if (!hostId) {
    return res.status(401).json({ error: 'Unauthorized: Account required to create meeting' });
  }

  const attendeeInput = attendeeEmails ?? guestEmails;
  const guests = Array.isArray(attendeeInput) ? attendeeInput : [];
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
        description: description || null,
        guestEmails: guests,
        moderatorEmails: moderators,
        hostId,
        configs: {
          create: {
            lobbyEnabled: lobbyEnabled !== undefined ? !!lobbyEnabled : true,
            lobbyForm: lobbyFormValue(lobbyForm),
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
    if (isScheduled && start && end && syncGoogleCal && req.user) {
      const eventId = await syncGoogleCalendarEvent(hostId, {
        title,
        description: description || null,
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
      await redisClient.set(cacheKey, JSON.stringify(sanitizeMeetingConfig(meeting.configs)));
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
    attendeeEmails,
    moderatorEmails,
    lobbyEnabled,
    stagePromotionEnabled,
    allowParticipantRecording,
    roomDefaults,
    syncGoogleCal,
    description,
    lobbyForm,
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
    const attendeeInput = attendeeEmails ?? guestEmails;
    const guests = Array.isArray(attendeeInput) ? attendeeInput : meeting.guestEmails;
    const moderators = Array.isArray(moderatorEmails) ? moderatorEmails : meeting.moderatorEmails;

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        title: title || meeting.title,
        startTime: start,
        endTime: end,
        recurrence: rec,
        description: description !== undefined ? description : meeting.description,
        guestEmails: guests,
        moderatorEmails: moderators,
        configs: {
          upsert: {
            update: {
              lobbyEnabled: lobbyEnabled !== undefined ? !!lobbyEnabled : undefined,
              lobbyForm: lobbyForm !== undefined ? lobbyFormValue(lobbyForm) : undefined,
              stagePromotionEnabled: stagePromotionEnabled !== undefined ? !!stagePromotionEnabled : undefined,
              allowParticipantRecording: allowParticipantRecording !== undefined ? !!allowParticipantRecording : undefined,
              roomDefaults: roomDefaults ? JSON.stringify(roomDefaults) : undefined,
            },
            create: {
              lobbyEnabled: lobbyEnabled !== undefined ? !!lobbyEnabled : true,
              lobbyForm: lobbyFormValue(lobbyForm),
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
            description: updated.description,
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

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function emailInList(list: string[] | null | undefined, email?: string | null): boolean {
  if (!email || !list?.length) return false;
  const needle = email.trim().toLowerCase();
  return list.some((item) => item.trim().toLowerCase() === needle);
}

// Helper to determine role of a user in a meeting from the host account and email lists.
async function getMeetingRoleForUser(roomName: string, userId?: string): Promise<LoungeMeshRole> {
  if (!userId) return 'attendee';
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true, host: { select: { email: true } } },
    });
    if (!meeting) return 'attendee';
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) return 'attendee';
    if (sameEmail(user.email, meeting.host?.email) || meeting.hostId === userId) return 'host';
    if (meeting.configs?.userGrants) {
      const grants = JSON.parse(meeting.configs.userGrants);
      if (grants[userId]?.moderator) {
        return 'moderator';
      }
    }
    if (emailInList(meeting.moderatorEmails, user.email)) {
      return 'moderator';
    }
    return 'attendee';
  } catch (err) {
    console.error('Error in getMeetingRoleForUser:', err);
    return 'attendee';
  }
}

function invitationForEmail(
  email: string | null | undefined,
  meeting: { host?: { email: string } | null; guestEmails: string[]; moderatorEmails: string[] },
): boolean {
  if (!email) return false;
  return (
    sameEmail(email, meeting.host?.email) ||
    emailInList(meeting.guestEmails, email) ||
    emailInList(meeting.moderatorEmails, email)
  );
}

export async function getMeetingRole(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      select: {
        hostId: true,
        guestEmails: true,
        moderatorEmails: true,
        eventyayEventSlug: true,
        host: { select: { email: true } },
      },
    });
    if (!meeting) {
      return res.json({ role: 'attendee', hostId: null, hostEmail: null, isInvited: false, moderatorEmails: [], guestEmails: [] });
    }

    // For Eventyay-linked meets, role is determined solely by the validated grant session
    if (meeting.eventyayEventSlug) {
      if (req.access && req.access.room === roomName) {
        return res.json({
          role: normalizeRole(req.access.role),
          hostId: meeting.hostId,
          hostEmail: meeting.host?.email || null,
          isInvited: !req.access.sub?.startsWith('guest:'),
          moderatorEmails: meeting.moderatorEmails,
          guestEmails: meeting.guestEmails,
        });
      }
      return res.json({
        role: 'attendee',
        hostId: meeting.hostId,
        hostEmail: meeting.host?.email || null,
        isInvited: false,
        moderatorEmails: meeting.moderatorEmails,
        guestEmails: meeting.guestEmails,
      });
    }

    const role = await getMeetingRoleForUser(roomName, req.user?.id);
    const isInvited = invitationForEmail(req.user?.email, meeting);
    return res.json({
      role,
      hostId: meeting.hostId,
      hostEmail: meeting.host?.email || null,
      isInvited,
      moderatorEmails: meeting.moderatorEmails,
      guestEmails: meeting.guestEmails,
    });
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
      return res.json(sanitizeMeetingConfig(JSON.parse(cached)));
    }

    const meeting = (await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    })) as any;

    if (!meeting || !meeting.configs) {
      return res.status(404).json({ error: 'Config not found' });
    }

    const publicConfig = sanitizeMeetingConfig(meeting.configs);

    // Cache in Redis
    await redisClient.set(cacheKey, JSON.stringify(publicConfig));

    return res.json(publicConfig);
  } catch (err) {
    console.error('Get meeting config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMeetingConfig(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { lobbyEnabled, lobbyForm, stagePromotionEnabled, allowParticipantRecording, notesTemplate } = req.body;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const anonUser = await prisma.user.findFirst({
      where: { email: 'anonymous@loungemesh.local' },
    });

    const isAnonymousMeeting = anonUser && meeting.hostId === anonUser.id;

    if (!isAnonymousMeeting) {
      const role = await getMeetingRoleForUser(roomName, req.user?.id);
      if (role !== 'host' && role !== 'moderator') {
        return res.status(403).json({ error: 'Forbidden: Only the host or a moderator can update config' });
      }
    }

    const updatedConfig = await prisma.meetingConfig.upsert({
      where: { meetingId: meeting.id },
      update: {
        lobbyEnabled: lobbyEnabled !== undefined ? lobbyEnabled : undefined,
        lobbyForm: lobbyForm !== undefined ? lobbyFormValue(lobbyForm) : undefined,
        stagePromotionEnabled: stagePromotionEnabled !== undefined ? stagePromotionEnabled : undefined,
        allowParticipantRecording: allowParticipantRecording !== undefined ? allowParticipantRecording : undefined,
        notesTemplate: notesTemplate !== undefined ? notesTemplate : undefined,
      },
      create: {
        meetingId: meeting.id,
        lobbyEnabled: !!lobbyEnabled,
        lobbyForm: lobbyFormValue(lobbyForm),
        stagePromotionEnabled: stagePromotionEnabled !== undefined ? stagePromotionEnabled : true,
        allowParticipantRecording: !!allowParticipantRecording,
        notesTemplate: notesTemplate !== undefined ? notesTemplate : null,
      },
    });

    // Sync Redis cache
    const publicConfig = sanitizeMeetingConfig(updatedConfig);
    const cacheKey = `meeting:config:${roomName}`;
    await redisClient.set(cacheKey, JSON.stringify(publicConfig));

    return res.json(publicConfig);
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

const DEFAULT_ENABLED_FEATURES = {
  chat: true,
  notes: true,
  whiteboard: true,
  poll: true,
  stage: true,
};

export async function getAccessState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const cacheKey = `meeting:state:${roomName}:access`;
  try {
    const raw = await redisClient.get(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.enabledFeatures) {
        parsed.enabledFeatures = { ...DEFAULT_ENABLED_FEATURES };
      }
      return res.json(parsed);
    }
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    });
    let defaults = null;
    let enabledFeatures = { ...DEFAULT_ENABLED_FEATURES };
    if (meeting?.configs?.roomDefaults) {
      try {
        const parsedDefaults = JSON.parse(meeting.configs.roomDefaults);
        if (parsedDefaults?.enabledFeatures) {
          enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...parsedDefaults.enabledFeatures };
          defaults = parsedDefaults.defaults ?? null;
        } else {
          defaults = parsedDefaults;
        }
      } catch {
        defaults = null;
      }
    }
    const grants = meeting?.configs?.userGrants ? JSON.parse(meeting.configs.userGrants) : {};
    const access = { defaults, grants, enabledFeatures };
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(access));
    return res.json(access);
  } catch (err) {
    console.error('Get access state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateAccessDefaults(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  const { defaults, enabledFeatures } = req.body;
  if (!defaults && !enabledFeatures) {
    return res.status(400).json({ error: 'Missing defaults or enabledFeatures payload' });
  }
  try {
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const anonUser = await prisma.user.findFirst({
      where: { email: 'anonymous@loungemesh.local' },
    });

    const isAnonymousMeeting = anonUser && meeting.hostId === anonUser.id;

    if (!isAnonymousMeeting) {
      const role = await getMeetingRoleForUser(roomName, req.user?.id);
      if (role !== 'host') {
        return res.status(403).json({ error: 'Forbidden: Only the host can update room defaults or enabled features' });
      }
    }

    const cacheKey = `meeting:state:${roomName}:access`;
    const raw = await redisClient.get(cacheKey);
    const access = raw ? JSON.parse(raw) : { defaults: null, grants: {}, enabledFeatures: { ...DEFAULT_ENABLED_FEATURES } };
    if (defaults !== undefined) {
      access.defaults = defaults;
    }
    if (enabledFeatures !== undefined) {
      access.enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...enabledFeatures };
    }
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(access));
    if (meeting) {
      const dbPayload = JSON.stringify({ defaults: access.defaults, enabledFeatures: access.enabledFeatures });
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { roomDefaults: dbPayload },
        create: { meetingId: meeting.id, roomDefaults: dbPayload },
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
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const anonUser = await prisma.user.findFirst({
      where: { email: 'anonymous@loungemesh.local' },
    });

    const isAnonymousMeeting = anonUser && meeting.hostId === anonUser.id;
    let callerRole: LoungeMeshRole = 'attendee';

    if (!isAnonymousMeeting) {
      callerRole = await getMeetingRoleForUser(roomName, req.user?.id);
      if (callerRole !== 'host' && callerRole !== 'moderator') {
        return res.status(403).json({ error: 'Forbidden: Only the host or a moderator can update access grants' });
      }
    }

    // Only host can grant moderator role
    if (grants.moderator === true && callerRole !== 'host' && !isAnonymousMeeting) {
      return res.status(403).json({ error: 'Forbidden: Only the host can grant moderator privileges' });
    }

    const cacheKey = `meeting:state:${roomName}:access`;
    let access: any;
    const raw = await redisClient.get(cacheKey);
    if (raw) {
      access = JSON.parse(raw);
    } else {
      let defaults = null;
      let enabledFeatures = { ...DEFAULT_ENABLED_FEATURES };
      if (meeting?.configs?.roomDefaults) {
        try {
          const parsed = JSON.parse(meeting.configs.roomDefaults);
          if (parsed?.enabledFeatures) {
            enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...parsed.enabledFeatures };
            defaults = parsed.defaults;
          } else {
            defaults = parsed;
          }
        } catch {}
      }
      const grantsDb = meeting?.configs?.userGrants ? JSON.parse(meeting.configs.userGrants) : {};
      access = { defaults, grants: grantsDb, enabledFeatures };
    }

    const enabled = access.enabledFeatures || DEFAULT_ENABLED_FEATURES;
    // Check if any granted feature is disabled by host room-wide
    for (const [feat, val] of Object.entries(grants)) {
      if (feat !== 'moderator' && val === true && (enabled as Record<string, boolean>)[feat] === false) {
        return res.status(403).json({
          error: `Forbidden: Cannot grant "${feat}" because it is disabled by the host for this room`,
          feature: feat,
        });
      }
    }

    access.grants = access.grants || {};
    access.grants[userId] = grants;
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(access));
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

export async function getRoleSnapshot(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      select: { hostId: true, eventyayEventSlug: true, configs: true },
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    let role: 'host' | 'moderator' | 'attendee' = 'attendee';
    const userId = req.user?.id || (req.access?.sub) || 'anonymous';
    if (meeting.eventyayEventSlug) {
      if (req.access && req.access.room === roomName) {
        role = normalizeRole(req.access.role) as any;
      }
    } else {
      role = (await getMeetingRoleForUser(roomName, req.user?.id)) as any;
    }

    const accessKey = `meeting:state:${roomName}:access`;
    const raw = await redisClient.get(accessKey);
    let enabledFeatures = { ...DEFAULT_ENABLED_FEATURES };
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.enabledFeatures) {
          enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...parsed.enabledFeatures };
        }
      } catch {}
    } else if (meeting.configs?.roomDefaults) {
      try {
        const parsed = JSON.parse(meeting.configs.roomDefaults);
        if (parsed?.enabledFeatures) {
          enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...parsed.enabledFeatures };
        }
      } catch {}
    }

    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = jwt.sign(
      { sub: userId, room: roomName, role, enabledFeatures },
      process.env.JWT_SECRET || 'fallback-jwt-secret-for-dev',
      { expiresIn: '120s' }
    );
    return res.json({ token, role, enabledFeatures, exp });
  } catch (err) {
    console.error('getRoleSnapshot error:', err);
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
    const cached = await redisClient.get(cacheKey);
    if (cached !== null) {
      return res.json({ gridBackgroundUrl: cached });
    }
    const meeting = await prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true },
    });
    const gridBackgroundUrl = meeting?.configs?.gridBackgroundUrl || '';
    await redisClient.setEx(cacheKey, 86400, gridBackgroundUrl);
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
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { gridBackgroundUrl },
        create: { meetingId: meeting.id, gridBackgroundUrl },
      });
    }
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
    const meeting = await prisma.meeting.findUnique({ where: { roomName } });
    if (meeting) {
      await prisma.meetingConfig.upsert({
        where: { meetingId: meeting.id },
        update: { gridBackgroundUrl: null },
        create: { meetingId: meeting.id, gridBackgroundUrl: null },
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Clear background state error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getRoomInitialState(req: Request, res: Response) {
  const roomName = req.params.roomName as string;
  try {
    const meetingPromise = prisma.meeting.findUnique({
      where: { roomName },
      include: { configs: true, host: { select: { email: true } } },
    });

    const wbPromise = redisClient.get(`meeting:state:${roomName}:whiteboard`);
    const notesPromise = redisClient.get(`meeting:state:${roomName}:notes`);
    const accessPromise = redisClient.get(`meeting:state:${roomName}:access`);
    const pollPromise = redisClient.get(`meeting:state:${roomName}:poll`);
    const bgPromise = redisClient.get(`meeting:state:${roomName}:background`);

    const [meeting, rawWb, rawNotes, rawAccess, rawPoll, rawBg] = await Promise.all([
      meetingPromise,
      wbPromise,
      notesPromise,
      accessPromise,
      pollPromise,
      bgPromise,
    ]);

    let role: 'host' | 'moderator' | 'attendee' = 'attendee';
    const hostId: string | null = meeting ? meeting.hostId : null;
    const hostEmail: string | null = meeting?.host?.email || null;
    let isInvited = false;

    if (meeting) {
      if (meeting.eventyayEventSlug) {
        if (req.access && req.access.room === roomName) {
          role = normalizeRole(req.access.role) as any;
          isInvited = !req.access.sub?.startsWith('guest:');
        }
      } else {
        role = (await getMeetingRoleForUser(roomName, req.user?.id)) as any;
        isInvited = invitationForEmail(req.user?.email, meeting);
      }
    }

    const config = sanitizeMeetingConfig(meeting?.configs);
    const strokes = rawWb ? JSON.parse(rawWb) : [];
    let notes = rawNotes;
    if (notes === null) {
      notes = meeting?.configs?.sharedNotes || '';
    }

    let access: any = null;
    if (rawAccess) {
      access = JSON.parse(rawAccess);
      if (!access.enabledFeatures) {
        access.enabledFeatures = { ...DEFAULT_ENABLED_FEATURES };
      }
    } else {
      let defaults = null;
      let enabledFeatures = { ...DEFAULT_ENABLED_FEATURES };
      if (meeting?.configs?.roomDefaults) {
        try {
          const parsedDefaults = JSON.parse(meeting.configs.roomDefaults);
          if (parsedDefaults?.enabledFeatures) {
            enabledFeatures = { ...DEFAULT_ENABLED_FEATURES, ...parsedDefaults.enabledFeatures };
            defaults = parsedDefaults.defaults ?? null;
          } else {
            defaults = parsedDefaults;
          }
        } catch {
          defaults = null;
        }
      }
      const grants = meeting?.configs?.userGrants ? JSON.parse(meeting.configs.userGrants) : {};
      access = { defaults, grants, enabledFeatures };
    }

    const poll = rawPoll
      ? JSON.parse(rawPoll)
      : meeting?.configs?.activePoll
      ? JSON.parse(meeting.configs.activePoll)
      : null;

    const gridBackgroundUrl =
      rawBg !== null ? rawBg : meeting?.configs?.gridBackgroundUrl || '';

    return res.json({
      role: { role, hostId, hostEmail, isInvited, moderatorEmails: meeting?.moderatorEmails ?? [], guestEmails: meeting?.guestEmails ?? [] },
      config,
      whiteboard: { strokes },
      notes: { notes },
      access,
      poll: { poll },
      background: { gridBackgroundUrl },
    });
  } catch (err) {
    console.error('getRoomInitialState error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


