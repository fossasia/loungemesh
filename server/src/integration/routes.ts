import { Router } from 'express';
import {
  currentSession,
  exchangeGrant,
  heartbeat,
  leave,
  publicMeet,
  requireOAuthOwner,
  requireServiceSecret,
  upsertMeet,
} from './controller.js';

const router = Router();

// Browser exchange flow
router.post('/exchange', exchangeGrant);
router.get('/session', currentSession);
router.post('/heartbeat', heartbeat);
router.post('/leave', leave);

// Server-to-server meet management (called by Eventyay)
router.put('/meets', requireServiceSecret, requireOAuthOwner, upsertMeet);

// Public metadata
router.get('/public/meets/:event/:room', publicMeet);

export default router;
