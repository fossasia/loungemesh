import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import oauthRoutes from './oauth/routes.js';
import integrationRoutes from './integration/routes.js';
import { parseUserSession, apiLimiter } from './middleware/auth.js';
import { parseAccessSession } from './integration/access.js';

dotenv.config();

const app = express();

// Trust reverse proxies (Caddy, Nginx, Cloudflare) for accurate client IP, protocol, and secure cookie handling
app.set('trust proxy', 1);

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
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8880',
  'https://eventyay.com',
  ...extraOrigins,
];

export function isOriginAllowed(origin: string, extraList: string[] = allowedOrigins): boolean {
  if (extraList.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    // Allow localhost, loopback, and local development on any port
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === 'host.docker.internal') {
      return true;
    }
    // Allow eventyay.com, dev.eventyay.com, and any *.eventyay.com subdomain
    if (hostname === 'eventyay.com' || hostname.endsWith('.eventyay.com')) {
      return true;
    }
    for (const pat of extraList) {
      if (pat.includes('*')) {
        const regex = new RegExp('^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(origin)) return true;
      }
    }
  } catch {}
  return false;
}

app.use(
  cors((req: any, callback) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim();

    let isAllowed = false;
    if (!origin) {
      isAllowed = true;
    } else {
      if (isOriginAllowed(origin)) {
        isAllowed = true;
      } else {
        try {
          const originHost = new URL(origin).host;
          if ((host && originHost === host) || (forwardedHost && originHost === forwardedHost)) {
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
app.use(parseAccessSession);

// Apply rate limiting to all API endpoints
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Register routes
app.use('/oauth', oauthRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api', integrationRoutes);
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
