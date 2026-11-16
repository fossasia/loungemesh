import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import ics from 'ics';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // true for port 465, false for others
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@loungemesh.com';

const isSmtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
if (isSmtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

interface SendInviteParams {
  title: string;
  roomName: string;
  startTime: Date;
  endTime: Date;
  recurrence: string;
  guestEmails: string[];
  hostName: string;
  hostEmail: string;
  hostHeader: string;
  protocol?: string;
}

export interface SendLiveInviteParams {
  title: string;
  roomName: string;
  guestEmails: string[];
  inviterName: string;
  inviterEmail: string;
  hostHeader: string;
  protocol?: string;
}

export function buildMeetingJoinUrl(
  roomName: string,
  hostHeader: string,
  protocol?: string,
): string {
  const configured = (process.env.LOUNGEMESH_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    return `${configured}/session/${encodeURIComponent(roomName)}`;
  }
  const proto =
    protocol ||
    (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${hostHeader}/session/${encodeURIComponent(roomName)}`;
}

export async function sendMeetingInvitation(params: SendInviteParams) {
  const {
    title,
    roomName,
    startTime,
    endTime,
    recurrence,
    guestEmails,
    hostName,
    hostEmail,
    hostHeader,
    protocol,
  } = params;

  if (!guestEmails || guestEmails.length === 0) return;

  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMin = Math.max(1, Math.floor(durationMs / 60000));
  const joinUrl = buildMeetingJoinUrl(roomName, hostHeader, protocol || 'http');

  // Build standard ics event properties
  const eventAttributes: ics.EventAttributes = {
    title,
    description: `You are invited to a LoungeMesh spatial meeting.\n\nJoin Link: ${joinUrl}`,
    url: joinUrl,
    start: [
      startTime.getUTCFullYear(),
      startTime.getUTCMonth() + 1,
      startTime.getUTCDate(),
      startTime.getUTCHours(),
      startTime.getUTCMinutes(),
    ],
    duration: { minutes: durationMin },
    organizer: { name: hostName, email: hostEmail },
  };

  if (recurrence && recurrence !== 'NONE') {
    eventAttributes.recurrenceRule = `FREQ=${recurrence}`;
  }

  const { error, value: icsContent } = ics.createEvent(eventAttributes);

  if (error || !icsContent) {
    console.error('[MAILER] Failed to generate ICS content for email invite:', error);
    return;
  }

  if (!transporter) {
    const logPath = path.resolve(process.cwd(), 'invitations-debug.log');
    const logContent = `
================================================================================
[INVITATION SENT TO MOCK LOG]
Timestamp : ${new Date().toISOString()}
Host      : ${hostName} <${hostEmail}>
Recipients: ${guestEmails.join(', ')}
Subject   : Invitation: ${title} @ ${startTime.toLocaleString()}
Join Link : ${joinUrl}
--------------------------------------------------------------------------------
ICS FILE CONTENT:
${icsContent}
================================================================================
\n`;
    fs.appendFileSync(logPath, logContent, 'utf8');
    console.log(`[MAILER] SMTP not configured. Logged invitation for ${guestEmails.join(', ')} to server/invitations-debug.log`);
    return;
  }

  // Send individually to protect email privacy (undisclosed recipients behavior)
  for (const email of guestEmails) {
    try {
      await transporter.sendMail({
        from: `"${hostName} via LoungeMesh" <${SMTP_FROM}>`,
        to: email,
        subject: `Invitation: ${title} @ ${startTime.toLocaleString()}`,
        text: `You have been invited to a LoungeMesh spatial video meeting by ${hostName} (${hostEmail}).\n\nTitle: ${title}\nTime: ${startTime.toString()}\nJoin Link: ${joinUrl}\n\nThis email includes a calendar attachment to add this meeting to your schedule.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e2240; max-width: 600px; margin: 0 auto; border: 1px solid rgba(79, 110, 247, 0.15); border-radius: 16px; background: #ffffff;">
            <h2 style="color: #4f6ef7; margin-top: 0;">LoungeMesh Spatial Meeting Invitation</h2>
            <p><strong>${hostName}</strong> (${hostEmail}) has invited you to join a spatial meeting.</p>
            <div style="background: #f0f4ff; padding: 16px; border-radius: 12px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Meeting Title:</strong> ${title}</p>
              <p style="margin: 0 0 8px;"><strong>Time:</strong> ${startTime.toLocaleString()}</p>
              <p style="margin: 0;"><strong>Join Link:</strong> <a href="${joinUrl}" style="color: #4f6ef7; font-weight: bold; text-decoration: none;">Join LoungeMesh Session</a></p>
            </div>
            <p style="font-size: 13px; color: #6970a0;">This invitation contains a calendar file (.ics) which your email application should automatically parse to sync this event to your calendar.</p>
          </div>
        `,
        icalEvent: {
          filename: 'invite.ics',
          method: 'REQUEST',
          content: icsContent,
        },
      });
      console.log(`[MAILER] Successfully sent calendar invitation email to: ${email}`);
    } catch (err) {
      console.error(`[MAILER] Failed to send email to ${email}:`, err);
    }
  }
}

export async function sendLiveMeetingInvitation(params: SendLiveInviteParams): Promise<boolean> {
  const {
    title,
    roomName,
    guestEmails,
    inviterName,
    inviterEmail,
    hostHeader,
    protocol,
  } = params;

  if (!guestEmails || guestEmails.length === 0) return false;

  const joinUrl = buildMeetingJoinUrl(roomName, hostHeader, protocol);

  if (!transporter) {
    const logPath = path.resolve(process.cwd(), 'invitations-debug.log');
    const logContent = `
================================================================================
[LIVE INVITATION SENT TO MOCK LOG]
Timestamp : ${new Date().toISOString()}
Inviter   : ${inviterName} <${inviterEmail}>
Recipients: ${guestEmails.join(', ')}
Subject   : ${inviterName} invited you to join "${title}" on LoungeMesh
Join Link : ${joinUrl}
================================================================================
\n`;
    fs.appendFileSync(logPath, logContent, 'utf8');
    console.log(
      `[MAILER] SMTP not configured. Logged live invitation for ${guestEmails.join(', ')} to server/invitations-debug.log`,
    );
    return false;
  }

  let sentCount = 0;
  for (const email of guestEmails) {
    try {
      await transporter.sendMail({
        from: `"${inviterName} via LoungeMesh" <${SMTP_FROM}>`,
        to: email,
        subject: `${inviterName} invited you to join "${title}" on LoungeMesh`,
        text: `${inviterName} (${inviterEmail}) invited you to join an active LoungeMesh spatial meeting.\n\nMeeting: ${title}\nJoin now: ${joinUrl}\n`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e2240; max-width: 600px; margin: 0 auto; border: 1px solid rgba(79, 110, 247, 0.15); border-radius: 16px; background: #ffffff;">
            <h2 style="color: #4f6ef7; margin-top: 0;">Join LoungeMesh Meeting</h2>
            <p><strong>${inviterName}</strong> (${inviterEmail}) invited you to join a live spatial meeting.</p>
            <div style="background: #f0f4ff; padding: 16px; border-radius: 12px; margin: 20px 0;">
              <p style="margin: 0 0 12px;"><strong>Meeting:</strong> ${title}</p>
              <p style="margin: 0;">
                <a href="${joinUrl}" style="display: inline-block; background: #4f6ef7; color: #ffffff; padding: 10px 18px; border-radius: 9999px; font-weight: 600; text-decoration: none;">Join Session Now</a>
              </p>
            </div>
            <p style="font-size: 12px; color: #6970a0; word-break: break-all;">Or open directly: <a href="${joinUrl}" style="color: #4f6ef7;">${joinUrl}</a></p>
          </div>
        `,
      });
      sentCount += 1;
    } catch (err) {
      console.error(`[MAILER] Failed to send live invite email to ${email}:`, err);
    }
  }
  return sentCount > 0;
}
