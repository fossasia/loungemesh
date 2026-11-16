import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  updateMe,
  getGoogleAuthUrl,
  googleCallback,
} from '../controllers/authController.js';
import { requireAuth, authLimiter } from '../middleware/auth.js';

const router = Router();

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);

// Google OAuth
router.get('/google', authLimiter, getGoogleAuthUrl);
router.get('/google/callback', googleCallback);

export default router;
