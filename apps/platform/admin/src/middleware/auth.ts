import type { NextFunction, Request, Response } from 'express';
import { UserService } from '@teamsuzie/shared-auth';
import { sharedAuthConfig } from '../config.js';

export interface AdminSession {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  organizationId?: string;
}

export function getSession(req: Request): AdminSession {
  return req.session as unknown as AdminSession;
}

const userService = new UserService(sharedAuthConfig);

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Populate the session from a user access token (tsu_*) if one is present.
 * This lets laptop CLIs / mobile apps hit session-authed routes with a bearer.
 * Agent bearers (dtk_*) are handled by a separate middleware
 * (`authenticateAgentKey`) and are intentionally NOT accepted here.
 */
async function hydrateFromUserBearer(req: Request): Promise<boolean> {
  const token = extractBearer(req);
  if (!token || !token.startsWith('tsu_')) return false;

  const result = await userService.authenticateAccessToken(token);
  if (!result) return false;

  const session = req.session as unknown as AdminSession;
  session.userId = result.user.id;
  session.userEmail = result.user.email;
  session.userName = result.user.name;
  session.userRole = result.user.role;
  return true;
}

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = getSession(req);
  if (session.userId) {
    next();
    return;
  }
  try {
    if (await hydrateFromUserBearer(req)) {
      next();
      return;
    }
  } catch (err) {
    console.error(
      `[admin.auth] user-bearer auth error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  res.status(401).json({ error: 'Not authenticated' });
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = getSession(req);
  if (!session.userId) {
    const ok = await hydrateFromUserBearer(req).catch(() => false);
    if (!ok) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
  }
  if (getSession(req).userRole !== 'admin') {
    res.status(403).json({ error: 'Admin role required' });
    return;
  }
  next();
}
