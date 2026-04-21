import type { NextFunction, Request, Response } from 'express';

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

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (session.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin role required' });
    return;
  }
  next();
}
