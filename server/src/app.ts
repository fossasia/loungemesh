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
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
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
