import type { Request, Response } from 'express';
import { AuditLog, getRequestActor, API_KEY_SCOPES, type ApiKeyScope } from '@teamsuzie/shared-auth';
import { getSession } from '../middleware/auth.js';
import {
  AgentKeysService,
  ServiceInputError,
  type CreateAgentKeyInput,
} from '../services/agent-keys.js';

const ALL_SCOPES = Object.keys(API_KEY_SCOPES) as ApiKeyScope[];

function asObject(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function coerceScopes(raw: unknown): ApiKeyScope[] {
  if (!Array.isArray(raw)) return [];
  const out: ApiKeyScope[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && ALL_SCOPES.includes(v as ApiKeyScope)) {
      out.push(v as ApiKeyScope);
    }
  }
  return out;
}

export class AgentKeysController {
  constructor(private readonly keys: AgentKeysService) {}

  private logOk(req: Request, action: string, extra = ''): void {
    const actor = getRequestActor(req);
    console.log(
      `[admin.agent-keys.${action}] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''}`,
    );
  }

  private logFail(req: Request, action: string, err: unknown, extra = ''): void {
    const actor = getRequestActor(req);
    console.error(
      `[admin.agent-keys.${action}] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''} err=${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async writeAudit(
    actorId: string | null,
    action: 'api_key.create' | 'api_key.revoke',
    resourceId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await AuditLog.create({
        actor_type: 'user',
        actor_id: actorId,
        action,
        resource_type: 'agent_api_key',
        resource_id: resourceId,
        details,
      } as Partial<AuditLog>);
    } catch (err) {
      console.warn(
        `[admin.agent-keys.audit] write failed action=${action} resource=${resourceId} err=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async resolveOrg(req: Request, res: Response): Promise<string | null> {
    const session = getSession(req);
    const orgId = await this.keys.resolveOrgId(session.userId!);
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return null;
    }
    return orgId;
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const items = await this.keys.list(orgId);
      this.logOk(req, 'list', `count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'list', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list keys' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const body = asObject(req.body);
    if (!body) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const agent_id = typeof body.agent_id === 'string' ? body.agent_id : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const scopes = coerceScopes(body.scopes);
    const rate_limit_per_minute =
      typeof body.rate_limit_per_minute === 'number' && body.rate_limit_per_minute > 0
        ? Math.floor(body.rate_limit_per_minute)
        : undefined;
    const expires_in_days =
      body.expires_in_days === null
        ? null
        : typeof body.expires_in_days === 'number' && body.expires_in_days > 0
          ? body.expires_in_days
          : undefined;

    if (!agent_id) {
      res.status(400).json({ error: 'agent_id is required' });
      return;
    }

    const input: CreateAgentKeyInput = {
      agent_id,
      name,
      scopes,
      rate_limit_per_minute,
      expires_in_days: expires_in_days ?? null,
    };

    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const result = await this.keys.create(input, {
        userId: session.userId!,
        organizationId: orgId,
      });
      await this.writeAudit(session.userId ?? null, 'api_key.create', result.summary.id, {
        agent_id: result.summary.agent_id,
        agent_name: result.summary.agent_name,
        name: result.summary.name,
        key_prefix: result.summary.key_prefix,
        scopes: result.summary.scopes,
        expires_at: result.summary.expires_at,
      });
      this.logOk(
        req,
        'create',
        `id=${result.summary.id} agent=${result.summary.agent_id} prefix=${result.summary.key_prefix}`,
      );
      res.status(201).json({ key: result.key, summary: result.summary });
    } catch (err) {
      this.logFail(req, 'create', err, `agent=${agent_id}`);
      if (err instanceof ServiceInputError) {
        res.status(err.code === 'NOT_FOUND' ? 404 : 400).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create key' });
    }
  };

  revoke = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const id = String(req.params.id);
    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const summary = await this.keys.revoke(id, {
        userId: session.userId!,
        organizationId: orgId,
      });
      if (!summary) {
        res.status(404).json({ error: 'Key not found' });
        return;
      }
      await this.writeAudit(session.userId ?? null, 'api_key.revoke', summary.id, {
        agent_id: summary.agent_id,
        agent_name: summary.agent_name,
        name: summary.name,
        key_prefix: summary.key_prefix,
      });
      this.logOk(req, 'revoke', `id=${id}`);
      res.json({ summary });
    } catch (err) {
      this.logFail(req, 'revoke', err, `id=${id}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to revoke key' });
    }
  };

  listScopes = async (req: Request, res: Response): Promise<void> => {
    try {
      const scopes = ALL_SCOPES.map((s) => ({ scope: s, description: API_KEY_SCOPES[s] }));
      this.logOk(req, 'listScopes', `count=${scopes.length}`);
      res.json({ scopes });
    } catch (err) {
      this.logFail(req, 'listScopes', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list scopes' });
    }
  };
}
