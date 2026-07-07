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

const router = Router();

// Scheduled Meetings & Room Creation
router.post('/', requireAuth, createMeeting);
router.get('/upcoming', requireAuth, getUpcomingMeetings);
router.put('/:id', requireAuth, updateMeeting);
router.delete('/:id', requireAuth, cancelMeeting);

// Configurations & Live roles
router.get('/role/:roomName', getMeetingRole);
router.get('/config/:roomName', getMeetingConfig);
router.put('/config/:roomName', requireAuth, updateMeetingConfig);

// Session Logging
router.post('/log/:roomName', addSessionLog);

// In-Memory Notes & Whiteboard State Persistence
router.get('/state/:roomName/whiteboard', getWhiteboardState);
router.post('/state/:roomName/whiteboard/stroke', addWhiteboardStroke);
router.post('/state/:roomName/whiteboard/clear', clearWhiteboardState);
router.get('/state/:roomName/notes', getNotesState);
router.post('/state/:roomName/notes', updateNotesState);

// In-Memory Moderator/Access Settings & Poll State Persistence
router.get('/state/:roomName/access', getAccessState);
router.post('/state/:roomName/access/defaults', requireAuth, updateAccessDefaults);
router.post('/state/:roomName/access/grants', requireAuth, updateAccessGrants);
router.get('/state/:roomName/poll', getPollState);
router.post('/state/:roomName/poll', updatePollState);
router.delete('/state/:roomName/poll', clearPollState);

// In-Memory Background Persistence (Large base64 payload, stored in Redis to avoid DB bloat)
router.get('/state/:roomName/background', getBackgroundState);
router.post('/state/:roomName/background', updateBackgroundState);
router.delete('/state/:roomName/background', clearBackgroundState);

export default router;


