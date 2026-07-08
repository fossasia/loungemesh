import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import { parseUserSession, apiLimiter } from './middleware/auth.js';

dotenv.config();

const app = express();

// Configure CORS for local development and production
const extraOrigins = (process.env.ALLOWED_OAUTH_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8780',
  'http://127.0.0.1:8780',
  ...extraOrigins
];

app.use(
  cors((req: any, callback) => {
    const origin = req.headers.origin;
    const host = req.headers.host;

    let isAllowed = false;
    if (!origin) {
      isAllowed = true;
    } else {
      if (allowedOrigins.includes(origin)) {
        isAllowed = true;
      } else {
        try {
          const originHost = new URL(origin).host;
          if (host && originHost === host) {
            isAllowed = true;
          }
        } catch (err) {}
      }
    }

    if (isAllowed) {
      callback(null, { origin: true, credentials: true });
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  })
);

app.use(express.json());
app.use(cookieParser());

// Apply global session parser to decrypt token cookies
app.use(parseUserSession);

// Apply rate limiting to all API endpoints
app.use('/api', apiLimiter);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/calendar', calendarRoutes);

// General 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express handler error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
