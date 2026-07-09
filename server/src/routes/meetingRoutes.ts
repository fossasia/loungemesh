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
} from '../controllers/meetingController.js';
import { requireAuth } from '../middleware/auth.js';

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
router.get('/config/:roomName', noCache, getMeetingConfig);
router.put('/config/:roomName', noCache, updateMeetingConfig);

// Session Logging
router.post('/log/:roomName', noCache, addSessionLog);

// In-Memory Notes & Whiteboard State Persistence
router.get('/state/:roomName/whiteboard', noCache, getWhiteboardState);
router.post('/state/:roomName/whiteboard/stroke', noCache, addWhiteboardStroke);
router.post('/state/:roomName/whiteboard/clear', noCache, clearWhiteboardState);
router.get('/state/:roomName/notes', noCache, getNotesState);
router.post('/state/:roomName/notes', noCache, updateNotesState);

// In-Memory Moderator/Access Settings & Poll State Persistence
router.get('/state/:roomName/access', noCache, getAccessState);
router.post('/state/:roomName/access/defaults', noCache, updateAccessDefaults);
router.post('/state/:roomName/access/grants', noCache, updateAccessGrants);
router.get('/state/:roomName/poll', noCache, getPollState);
router.post('/state/:roomName/poll', noCache, updatePollState);
router.delete('/state/:roomName/poll', noCache, clearPollState);

// In-Memory Background Persistence (Large base64 payload, stored in Redis to avoid DB bloat)
router.get('/state/:roomName/background', noCache, getBackgroundState);
router.post('/state/:roomName/background', noCache, updateBackgroundState);
router.delete('/state/:roomName/background', noCache, clearBackgroundState);

export default router;


