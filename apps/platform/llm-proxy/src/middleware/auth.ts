import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
    namespace Express {
        interface Request {
            keyHash?: string;
        }
    }
}

/**
 * LLM-proxy authentication — agent / service bearer lane.
 *
 * The proxy is called by agent runtimes (OpenClaw, LangGraph adapters, etc.),
 * never by a browser. Every request MUST carry `Authorization: Bearer <token>`;
 * we hash the token and use the hash for per-agent usage attribution downstream.
 * The token itself is never logged or persisted — only its SHA-256 prefix.
 *
 * See docs/SECURITY_MODEL.md for the three-lane auth model.
 *
 * This middleware does NOT validate the token against a database — that would
 * put the DB on the hot path of every LLM call. Validation is delegated to the
 * ownership of the key (agent runtime holds it, admin manages it); the proxy
 * trusts whoever has the token. If you need stronger proxy-side validation,
 * gate the proxy behind a sidecar that performs verification and forwards the
 * request with a short-lived token.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
        res.status(401).json({ error: 'Empty Bearer token' });
        return;
    }

    req.keyHash = crypto.createHash('sha256').update(token).digest('hex');
    next();
}
