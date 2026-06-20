import { Router } from 'express';
import { getIcsFeed } from '../controllers/calendarController.js';

const router = Router();

// Endpoint for Google Calendar / user clients to subscribe to a host's schedule
router.get('/feed/:userId.ics', getIcsFeed);
router.get('/feed/:userId', getIcsFeed);

export default router;
