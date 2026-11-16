import { Request, Response } from 'express';
import ics from 'ics';
import { prisma } from '../config/db.js';

export async function getIcsFeed(req: Request, res: Response) {
  const userId = req.params.userId as string;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const meetings = await prisma.meeting.findMany({
      where: {
        hostId: userId,
        isScheduled: true,
      },
    });

    const events: ics.EventAttributes[] = [];

    for (const meet of meetings) {
      if (!meet.startTime || !meet.endTime) continue;

      const start = meet.startTime;
      const end = meet.endTime;
      const durationMs = end.getTime() - start.getTime();
      const durationMin = Math.max(1, Math.floor(durationMs / 60000));

      const host = req.headers.host || 'localhost:8780';
      const event: ics.EventAttributes = {
        title: meet.title,
        description: `Join LoungeMesh Spatial Meet: http://${host}/session/${meet.roomName}`,
        url: `http://${host}/session/${meet.roomName}`,
        start: [
          start.getUTCFullYear(),
          start.getUTCMonth() + 1,
          start.getUTCDate(),
          start.getUTCHours(),
          start.getUTCMinutes(),
        ],
        duration: { minutes: durationMin },
      };

      if (meet.recurrence && meet.recurrence !== 'NONE') {
        event.recurrenceRule = `FREQ=${meet.recurrence}`;
      }

      events.push(event);
    }

    if (events.length === 0) {
      // Return empty valid calendar
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      return res.send('BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//LoungeMesh//Calendar Feed//EN\nEND:VCALENDAR');
    }

    const { error, value } = ics.createEvents(events);

    if (error) {
      console.error('Error creating ICS events:', error);
      return res.status(500).json({ error: 'Failed to generate calendar' });
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="meetings_${user.displayName.replace(/\s+/g, '_')}.ics"`);
    return res.send(value);
  } catch (err) {
    console.error('ICS feed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
