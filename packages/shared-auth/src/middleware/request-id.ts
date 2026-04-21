import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

const HEADER = 'x-request-id';
const INCOMING_MAX_LEN = 128;
const INCOMING_VALID = /^[A-Za-z0-9_.:\-]{6,128}$/;

export interface RequestIdOptions {
    /**
     * When true (default), accept a caller-supplied X-Request-Id and reuse it.
     * Only accepted when the value matches INCOMING_VALID to keep the header safe
     * for logs and for forwarding upstream.
     *
     * Set to false on internet-facing edges where you want to mint your own id
     * and ignore whatever a client sent.
     */
    trustIncoming?: boolean;
    /** Custom id generator — defaults to crypto.randomUUID(). */
    generate?: () => string;
}

/**
 * Express middleware that attaches a request id to every request.
 *
 * - Reads X-Request-Id from the incoming request (if trusted), else generates one.
 * - Exposes it on `req.requestId`.
 * - Echoes it back on the response as X-Request-Id so clients and load balancers
 *   can correlate their view of the request with server logs.
 *
 * Every OSS Express service should mount this near the top of the middleware
 * stack, before auth and route handlers. Downstream fetches to other Team Suzie
 * services SHOULD forward `req.requestId` as the X-Request-Id header.
 */
export function createRequestId(options: RequestIdOptions = {}) {
    const trustIncoming = options.trustIncoming !== false;
    const generate = options.generate ?? randomUUID;

    return function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
        let id: string | undefined;

        if (trustIncoming) {
            const incoming = req.headers[HEADER];
            const raw = Array.isArray(incoming) ? incoming[0] : incoming;
            if (typeof raw === 'string' && raw.length <= INCOMING_MAX_LEN && INCOMING_VALID.test(raw)) {
                id = raw;
            }
        }

        if (!id) {
            id = generate();
        }

        req.requestId = id;
        res.setHeader('X-Request-Id', id);
        next();
    };
}

export default createRequestId;
