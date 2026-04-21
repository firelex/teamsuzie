import type { Request, Response, NextFunction } from 'express';

export interface ServiceAuthConfig {
    /** The shared secret key for service-to-service auth */
    serviceKey: string | undefined;
}

/**
 * Service-to-service bearer-token auth lane.
 *
 * Used by internal Team Suzie services to authenticate RPC-style calls to each
 * other (admin ←→ llm-proxy, for example). It is NOT user auth — the key does
 * not identify a user or org, and routes guarded by this middleware must not
 * perform actions on a user's behalf. Routes that need an actor use either the
 * browser-session lane (CSRF-protected) or the agent-bearer lane.
 *
 * See docs/SECURITY_MODEL.md for the full security model.
 *
 * Accepts the key via:
 *   - Authorization: Bearer {key}
 *   - X-Service-Key: {key}
 *
 * @param config - Object containing the serviceKey to validate against
 * @returns Express middleware function
 */
export function createServiceAuth(config: ServiceAuthConfig) {
    return function serviceAuth(req: Request, res: Response, next: NextFunction): void {
        const { serviceKey } = config;

        if (!serviceKey) {
            res.status(503).json({
                error: 'Service Unavailable',
                message: 'Service key not configured'
            });
            return;
        }

        const authHeader = req.headers.authorization;
        const provided = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : (req.headers['x-service-key'] as string);

        if (!provided || provided !== serviceKey) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid service key'
            });
            return;
        }

        next();
    };
}
