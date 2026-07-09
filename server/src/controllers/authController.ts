import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { encryptToken } from '../utils/crypto.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-for-dev';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

// Initialize Google OAuth2 client credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

function getBaseUri(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost:8780';
  const origin = `${proto}://${host}`;
  const allowedOriginsEnv = process.env.ALLOWED_OAUTH_ORIGINS || 'http://localhost:8780,https://loungemesh.com,https://www.loungemesh.com';
  const allowedOrigins = allowedOriginsEnv.split(',').map(o => o.trim());
  const isValid = allowedOrigins.includes(origin) || allowedOrigins.includes(`${proto}://${host.split(':')[0]}`);
  return isValid ? origin : (allowedOrigins[0] || 'http://localhost:8780');
}

function getGoogleClient(req: Request): OAuth2Client {
  const baseUri = getBaseUri(req);
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${baseUri}/api/auth/google/callback`
  );
}

export async function signup(req: Request, res: Response) {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    // Sign session JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json(user);
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: Request, res: Response) {
  if (req.user) {
    // Clear session cache in Redis
    await redisClient.del(`session:user:${req.user.id}`);
  }
  res.clearCookie('token');
  return res.json({ success: true });
}

export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json(req.user);
}

export async function updateMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { displayName, avatarUrl } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        displayName: displayName || req.user.displayName,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : req.user.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        googleId: true,
      },
    });

    // Update Redis cache
    await redisClient.setEx(`session:user:${req.user.id}`, 600, JSON.stringify(updatedUser));

    return res.json(updatedUser);
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Google OAuth Flow ────────────────────────────────────────────────────────

export async function getGoogleAuthUrl(req: Request, res: Response) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth not configured on backend' });
  }

  const googleClient = getGoogleClient(req);
  const url = googleClient.generateAuthUrl({
    access_type: 'offline', // Requests refresh token
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar.events', // Google Calendar access
    ],
    prompt: 'consent', // Required to force Google to yield refresh token on subsequent logins
  });

  return res.json({ url });
}

export async function googleCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  const baseUri = getBaseUri(req);
  if (!code) {
    return res.redirect(`${baseUri}/?error=no_code`);
  }

  try {
    const googleClient = getGoogleClient(req);
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Fetch user info directly from Google APIs using access token
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoRes.ok) {
      throw new Error(`Failed to fetch Google user info: ${userInfoRes.statusText}`);
    }

    const googleUser = (await userInfoRes.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email) {
      return res.redirect(`${baseUri}/?error=no_email`);
    }

    const email = googleUser.email;
    const name = googleUser.name || 'Google User';
    const avatarUrl = googleUser.picture || null;

    // Encrypt the OAuth token payload using AES-256-GCM
    const encryptedToken = encryptToken(JSON.stringify(tokens));

    // Upsert the user record
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          googleToken: encryptedToken,
          avatarUrl: user.avatarUrl || avatarUrl,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          displayName: name,
          avatarUrl,
          googleId: googleUser.id,
          googleToken: encryptedToken,
        },
      });
    }

    // Set HttpOnly session cookie
    const sessionToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Clear session cache in Redis to trigger refresh
    await redisClient.del(`session:user:${user.id}`);

    // Redirect user back to home page
    return res.redirect(`${baseUri}/?success=google_linked`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`${baseUri}/?error=oauth_failed`);
  }
}
