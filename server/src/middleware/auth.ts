import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { redisClient } from '../config/redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-for-dev';

// Extend Express Request interface to include req.user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl?: string | null;
        googleId?: string | null;
      };
    }
  }
}

export async function parseUserSession(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const cacheKey = `session:user:${decoded.userId}`;

    // Try to get user from Redis cache
    let cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      req.user = JSON.parse(cachedUser);
      return next();
    }

    // Fallback to DB query
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        googleId: true,
      },
    });

    if (user) {
      req.user = user;
      // Cache user session in Redis for 10 minutes (600 seconds)
      await redisClient.setEx(cacheKey, 600, JSON.stringify(user));
    }
    
    next();
  } catch (err) {
    // If JWT expires or is invalid, clear token cookie and proceed
    res.clearCookie('token');
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// ── Rate Limiters (Dummy pass-through, rate limiting handled via Nginx / Cloudflare) ──

export function apiLimiter(req: Request, res: Response, next: NextFunction) {
  next();
}

export function authLimiter(req: Request, res: Response, next: NextFunction) {
  next();
}
