import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { publicUrl } from '../config/deploy.js';
import { randomToken, sha256, verifyPkceS256 } from './crypto.js';

const CODE_TTL_SECONDS = 60;
const ACCESS_TTL_SECONDS = 3600 * 24; // 24 hours
const REFRESH_TTL_SECONDS = 3600 * 24 * 30; // 30 days

export function isRedirectUriAllowed(allowedUris: string[], candidate: string): boolean {
  if (allowedUris.includes(candidate)) return true;
  try {
    const candUrl = new URL(candidate);
    const host = candUrl.hostname;
    // Allow localhost, 127.0.0.1, or docker host for local dev testing
    if (host === 'localhost' || host === '127.0.0.1' || host === 'host.docker.internal') {
      if (candUrl.pathname.includes('loungemesh') && candUrl.pathname.includes('callback')) {
        return true;
      }
    }
    // Allow official eventyay domains (eventyay.com, dev.eventyay.com, *.eventyay.com)
    if (host === 'eventyay.com' || host.endsWith('.eventyay.com')) {
      if (candUrl.pathname.includes('loungemesh') && candUrl.pathname.includes('callback')) {
        return true;
      }
    }
    for (const pat of allowedUris) {
      if (pat.includes('*')) {
        const regex = new RegExp('^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(candidate)) return true;
      }
    }
  } catch {}
  return false;
}

/**
 * GET /oauth/authorize
 * Query params: client_id, redirect_uri, response_type, state, code_challenge, code_challenge_method
 */
export async function authorize(req: Request, res: Response) {
  const {
    client_id,
    redirect_uri,
    response_type,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query as Record<string, string>;

  if (response_type !== 'code') {
    return res.status(400).send('unsupported_response_type: only "code" is supported');
  }

  if (!client_id || !redirect_uri || !code_challenge) {
    return res.status(400).send('invalid_request: client_id, redirect_uri, and code_challenge are required');
  }

  if (code_challenge_method && code_challenge_method !== 'S256') {
    return res.status(400).send('invalid_request: only code_challenge_method=S256 is supported');
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });

  if (!client) {
    return res.status(400).send('unauthorized_client: unknown client_id');
  }

  if (!isRedirectUriAllowed(client.redirectUris, redirect_uri)) {
    return res.status(400).send('invalid_request: redirect_uri not allowed for this client');
  }

  // If user is not authenticated in LoungeMesh, redirect to login page with return_to
  if (!req.user) {
    const returnUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/?auth=login&return_to=${returnUrl}`);
  }

  // Generate authorization code
  const rawCode = randomToken(32);
  const codeHash = sha256(rawCode);

  await prisma.oAuthCode.create({
    data: {
      code: codeHash,
      clientId: client_id,
      userId: req.user.id,
      codeChallenge: code_challenge,
      redirectUri: redirect_uri,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    },
  });

  const redirectTarget = new URL(redirect_uri);
  redirectTarget.searchParams.set('code', rawCode);
  if (state) {
    redirectTarget.searchParams.set('state', state);
  }

  return res.redirect(redirectTarget.toString());
}

/**
 * POST /oauth/token
 * Supports grant_type=authorization_code and grant_type=refresh_token
 */
export async function token(req: Request, res: Response) {
  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    client_secret,
    code_verifier,
    refresh_token,
  } = req.body || {};

  if (!client_id) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });

  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // If clientSecretHash is configured, verify client_secret
  if (client.clientSecretHash) {
    if (!client_secret || sha256(client_secret) !== client.clientSecretHash) {
      return res.status(401).json({ error: 'invalid_client' });
    }
  }

  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'code, redirect_uri, and code_verifier are required',
      });
    }

    const codeHash = sha256(code);
    const authCode = await prisma.oAuthCode.findUnique({
      where: { code: codeHash },
    });

    if (!authCode || authCode.used || authCode.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Code is invalid or expired' });
    }

    if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Client or redirect_uri mismatch' });
    }

    // Verify PKCE
    if (!verifyPkceS256(code_verifier, authCode.codeChallenge)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }

    // Mark code as used atomically to prevent race condition
    const claimed = await prisma.oAuthCode.updateMany({
      where: { code: codeHash, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (claimed.count !== 1) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Code is invalid or expired' });
    }

    // Issue tokens
    const rawAccessToken = randomToken(32);
    const rawRefreshToken = randomToken(32);
    const accessHash = sha256(rawAccessToken);
    const refreshHash = sha256(rawRefreshToken);

    await prisma.oAuthToken.create({
      data: {
        userId: authCode.userId,
        clientId: client_id,
        accessHash,
        refreshHash,
        expiresAt: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000),
      },
    });

    return res.json({
      access_token: rawAccessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: rawRefreshToken,
    });
  }

  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required' });
    }

    const refreshHash = sha256(refresh_token);
    const tokenRecord = await prisma.oAuthToken.findUnique({
      where: { refreshHash },
    });

    if (!tokenRecord || tokenRecord.clientId !== client_id) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
    }

    // Issue new tokens & rotate atomically
    const rawAccessToken = randomToken(32);
    const rawRefreshToken = randomToken(32);
    const accessHash = sha256(rawAccessToken);
    const newRefreshHash = sha256(rawRefreshToken);

    const rotated = await prisma.oAuthToken.updateMany({
      where: { id: tokenRecord.id, refreshHash },
      data: {
        accessHash,
        refreshHash: newRefreshHash,
        expiresAt: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000),
      },
    });
    if (rotated.count !== 1) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token already rotated or invalid' });
    }

    return res.json({
      access_token: rawAccessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: rawRefreshToken,
    });
  }

  return res.status(400).json({ error: 'unsupported_grant_type' });
}

/**
 * GET /oauth/userinfo
 * Header: Authorization: Bearer <token>
 */
export async function userinfo(req: Request, res: Response) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const rawToken = authHeader.substring(7).trim();
  const accessHash = sha256(rawToken);

  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { accessHash },
  });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenRecord.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  return res.json({
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.displayName,
    picture: user.avatarUrl || null,
  });
}
