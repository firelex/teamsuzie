import type { Request } from 'express';

/**
 * Normalized "who is making this request" descriptor for structured logs,
 * audit-log rows, and usage events.
 *
 * Kept deliberately small. The caller is expected to pull one of these at the
 * top of an action handler and either log it or hand it to the audit writer.
 * Avoid reaching into `req.session` / `req.agentContext` ad-hoc — attribution
 * drifts when each call site invents its own shape.
 */
export interface RequestActor {
    /** Which auth lane minted this actor. */
    type: 'session' | 'agent' | 'service' | 'anonymous';
    /** User UUID if the actor maps to a user (session or agent-on-behalf-of-user). */
    userId: string | null;
    /** Agent UUID if the request came in on an agent API key. */
    agentId: string | null;
    /** Org UUID, if resolvable. */
    orgId: string | null;
    /** Request id attached by the request-id middleware. */
    requestId: string | null;
}

interface SessionShape {
    userId?: string;
    userEmail?: string;
    organizationId?: string;
}

/**
 * Derive a RequestActor from the request. Does not throw; returns an
 * anonymous actor if nothing is set yet (e.g. called before the auth
 * middleware ran).
 */
export function getRequestActor(req: Request): RequestActor {
    const requestId = (req.requestId ?? null) as string | null;

    const agentCtx = req.agentContext;
    if (agentCtx) {
        return {
            type: 'agent',
            userId: agentCtx.user_id ?? null,
            agentId: agentCtx.agent_id ?? null,
            orgId: agentCtx.org_id ?? null,
            requestId,
        };
    }

    const session = (req.session ?? undefined) as (SessionShape | undefined);
    if (session?.userId) {
        return {
            type: 'session',
            userId: session.userId,
            agentId: null,
            orgId: session.organizationId ?? null,
            requestId,
        };
    }

    return {
        type: 'anonymous',
        userId: null,
        agentId: null,
        orgId: null,
        requestId,
    };
}
