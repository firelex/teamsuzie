import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Attach a request id to every request and echo it back as X-Request-Id.
 *
 * Accepts an incoming X-Request-Id when it looks sane, so an upstream caller
 * (admin, starter backend) can set an id once and have it carry through the
 * proxy logs and usage events. This is a local copy — the same behaviour lives
 * in packages/shared-auth/src/middleware/request-id.ts for services that pull
 * in shared-auth; llm-proxy intentionally stays independent.
 */
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

const HEADER = 'x-request-id';
const INCOMING_VALID = /^[A-Za-z0-9_.:\-]{6,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER];
    const raw = Array.isArray(incoming) ? incoming[0] : incoming;
    const id = (typeof raw === 'string' && INCOMING_VALID.test(raw)) ? raw : randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}
