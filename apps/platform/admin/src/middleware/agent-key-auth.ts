import type { NextFunction, Request, Response } from 'express';
import { Agent, AgentApiKey, verifyApiKey } from '@teamsuzie/shared-auth';

/**
 * Admin-owned agent-key bearer lane using the AgentApiKey model (multiple
 * named keys per agent with scopes). Kept separate from shared-auth's
 * AgentAuthMiddleware, which reads the legacy single-key fields on the Agent
 * model (`api_key_prefix` / `api_key_hash`). Both exist; this one is what
 * the admin's multi-key issuance flow produces.
 *
 * On success, populates `req.agentContext` with the same shape the legacy
 * middleware uses, so `getRequestActor(req)` picks it up automatically.
 */
export async function authenticateAgentKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header =
    (req.headers['x-agent-api-key'] as string | undefined) ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined);

  if (!header || !header.startsWith('dtk_')) {
    res.status(401).json({ error: 'Agent API key required', message: 'Set Authorization: Bearer dtk_...' });
    return;
  }

  try {
    const prefix = header.substring(0, 12);
    const candidates = await AgentApiKey.findAll({
      where: { key_prefix: prefix, is_active: true },
    });

    const now = new Date();
    let matched: AgentApiKey | null = null;
    for (const candidate of candidates) {
      if (candidate.expires_at && candidate.expires_at.getTime() <= now.getTime()) {
        continue;
      }
      if (!verifyApiKey(header, candidate.key_hash)) continue;
      matched = candidate;
      break;
    }

    if (!matched) {
      res.status(401).json({ error: 'Invalid agent API key' });
      return;
    }

    const agent = await Agent.findByPk(matched.agent_id);
    if (!agent || agent.status !== 'active') {
      res.status(401).json({ error: 'Agent not active' });
      return;
    }

    matched.last_used_at = now;
    matched.updated_by = matched.created_by;
    await matched.save();

    req.agentContext = {
      agent_id: agent.id,
      agent_name: agent.name,
      user_id: agent.user_id,
      org_id: agent.organization_id ?? null,
      organization_id: agent.organization_id ?? '',
      scopes: matched.scopes as string[],
      scope_hierarchy: [
        { scope: 'agent', scope_id: agent.id },
        ...(agent.organization_id ? [{ scope: 'org' as const, scope_id: agent.organization_id }] : []),
        { scope: 'global', scope_id: null },
      ],
    };

    next();
  } catch (err) {
    console.error(
      `[admin.agent-key-auth] fail err=${err instanceof Error ? err.message : String(err)}`,
    );
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Either-or auth: session or agent bearer. Runs session check first; if no
 * session, falls back to agent-key check. Used by routes (like approvals
 * propose) that legitimately accept both lanes.
 */
export async function sessionOrAgentKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = req.session as unknown as { userId?: string } | undefined;
  if (session?.userId) {
    next();
    return;
  }
  await authenticateAgentKey(req, res, next);
}
