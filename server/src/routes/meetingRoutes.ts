import { Router } from 'express';
import {
  createMeeting,
  getUpcomingMeetings,
  updateMeeting,
  cancelMeeting,
  getMeetingRole,
  getMeetingConfig,
  updateMeetingConfig,
  addSessionLog,
  getWhiteboardState,
  addWhiteboardStroke,
  clearWhiteboardState,
  getNotesState,
  updateNotesState,
  getAccessState,
  updateAccessDefaults,
  updateAccessGrants,
  getPollState,
  updatePollState,
  clearPollState,
  getBackgroundState,
  updateBackgroundState,
  clearBackgroundState,
  inviteMeetingAttendees,
  getRoleSnapshot,
  getRoomInitialState,
} from '../controllers/meetingController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCapability } from '../integration/access.js';

const noCache = (req: any, res: any, next: any) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

const router = Router();

// Scheduled Meetings & Room Creation
router.post('/', requireAuth, createMeeting);
router.get('/upcoming', requireAuth, getUpcomingMeetings);
router.put('/:id', requireAuth, updateMeeting);
router.delete('/:id', requireAuth, cancelMeeting);

// Configurations & Live roles
router.get('/role/:roomName', noCache, getMeetingRole);
router.get('/role-snapshot/:roomName', noCache, getRoleSnapshot);
router.get('/config/:roomName', noCache, getMeetingConfig);
router.put('/config/:roomName', noCache, requireCapability('settings'), updateMeetingConfig);

// Session Logging
router.post('/log/:roomName', noCache, addSessionLog);

// In-Memory Notes & Whiteboard State Persistence
router.get('/state/:roomName/whiteboard', noCache, getWhiteboardState);
router.post('/state/:roomName/whiteboard/stroke', noCache, requireCapability('whiteboard'), addWhiteboardStroke);
router.post('/state/:roomName/whiteboard/clear', noCache, requireCapability('moderate'), clearWhiteboardState);
router.get('/state/:roomName/notes', noCache, getNotesState);
router.post('/state/:roomName/notes', noCache, requireCapability('notes'), updateNotesState);

// In-Memory Moderator/Access Settings & Poll State Persistence
router.get('/state/:roomName/access', noCache, getAccessState);
router.post('/state/:roomName/access/defaults', noCache, requireCapability('settings'), updateAccessDefaults);
router.post('/state/:roomName/access/grants', noCache, requireCapability('moderate'), updateAccessGrants);
router.get('/state/:roomName/poll', noCache, getPollState);
router.post('/state/:roomName/poll', noCache, requireCapability('poll_manage'), updatePollState);
router.delete('/state/:roomName/poll', noCache, requireCapability('poll_manage'), clearPollState);

// In-Memory Background Persistence (Large base64 payload, stored in Redis to avoid DB bloat)
router.get('/state/:roomName/background', noCache, getBackgroundState);
router.post('/state/:roomName/background', noCache, requireCapability('moderate'), updateBackgroundState);
router.delete('/state/:roomName/background', noCache, requireCapability('moderate'), clearBackgroundState);

// In-Session Attendee Invitations (Host & Moderator)
router.post('/state/:roomName/invite', noCache, requireCapability('moderate'), inviteMeetingAttendees);

// Bundled Room Initial State (Ultra-fast single-roundtrip load)
router.get('/state/:roomName/init', noCache, getRoomInitialState);

export default router;



