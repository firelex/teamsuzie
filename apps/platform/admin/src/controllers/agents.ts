import type { Request, Response } from 'express';
import { getRequestActor } from '@teamsuzie/shared-auth';
import { getSession } from '../middleware/auth.js';
import {
  AgentsService,
  ServiceInputError,
  type AdminAgentConfig,
  type CreateAgentInput,
  type UpdateAgentInput,
} from '../services/agents.js';

function isAgentType(value: unknown): value is 'openclaw' | 'custom' {
  return value === 'openclaw' || value === 'custom';
}

function isAgentStatus(value: unknown): value is 'active' | 'inactive' | 'suspended' {
  return value === 'active' || value === 'inactive' || value === 'suspended';
}

function coerceConfig(raw: unknown): AdminAgentConfig | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') {
    throw new ServiceInputError('config must be an object');
  }
  return raw as AdminAgentConfig;
}

function coerceCreate(body: unknown): CreateAgentInput {
  if (!body || typeof body !== 'object') {
    throw new ServiceInputError('Request body must be an object');
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) throw new ServiceInputError('name is required');

  const description = b.description == null ? null : String(b.description);
  const agent_type = b.agent_type === undefined
    ? undefined
    : isAgentType(b.agent_type)
      ? b.agent_type
      : (() => { throw new ServiceInputError('agent_type must be "openclaw" or "custom"'); })();
  const status = b.status === undefined
    ? undefined
    : isAgentStatus(b.status)
      ? b.status
      : (() => { throw new ServiceInputError('status must be active, inactive, or suspended'); })();
  const profile_id = b.profile_id == null ? null : String(b.profile_id);

  return { name, description, agent_type, status, profile_id, config: coerceConfig(b.config) };
}

function coerceUpdate(body: unknown): UpdateAgentInput {
  if (!body || typeof body !== 'object') {
    throw new ServiceInputError('Request body must be an object');
  }
  const b = body as Record<string, unknown>;

  const patch: UpdateAgentInput = {};
  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) {
      throw new ServiceInputError('name must be a non-empty string');
    }
    patch.name = b.name.trim();
  }
  if (b.description !== undefined) patch.description = b.description == null ? null : String(b.description);
  if (b.agent_type !== undefined) {
    if (!isAgentType(b.agent_type)) throw new ServiceInputError('agent_type must be "openclaw" or "custom"');
    patch.agent_type = b.agent_type;
  }
  if (b.status !== undefined) {
    if (!isAgentStatus(b.status)) throw new ServiceInputError('status must be active, inactive, or suspended');
    patch.status = b.status;
  }
  if (b.profile_id !== undefined) patch.profile_id = b.profile_id == null ? null : String(b.profile_id);
  if (b.config !== undefined) patch.config = coerceConfig(b.config);
  return patch;
}

export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  private logOk(req: Request, action: string, extra: string = ''): void {
    const actor = getRequestActor(req);
    console.log(
      `[admin.agents.${action}] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''}`,
    );
  }

  private logFail(req: Request, action: string, err: unknown, extra: string = ''): void {
    const actor = getRequestActor(req);
    console.error(
      `[admin.agents.${action}] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''} err=${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async resolveOrg(req: Request, res: Response): Promise<string | null> {
    const session = getSession(req);
    const orgId = await this.agents.resolveOrgId(session.userId!);
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
      const items = await this.agents.listForOrg(orgId);
      this.logOk(req, 'list', `count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'list', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list agents' });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const agent = await this.agents.findForOrg(id, orgId);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      this.logOk(req, 'get', `id=${agent.id}`);
      res.json({ agent });
    } catch (err) {
      this.logFail(req, 'get', err, `id=${id}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load agent' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const session = getSession(req);
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const input = coerceCreate(req.body);
      const agent = await this.agents.create(input, { userId: session.userId!, organizationId: orgId });
      this.logOk(req, 'create', `id=${agent.id}`);
      res.status(201).json({ agent });
    } catch (err) {
      this.logFail(req, 'create', err);
      if (err instanceof ServiceInputError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create agent' });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    try {
      const session = getSession(req);
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const patch = coerceUpdate(req.body);
      const agent = await this.agents.update(id, patch, {
        userId: session.userId!,
        organizationId: orgId,
      });
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      this.logOk(req, 'update', `id=${agent.id}`);
      res.json({ agent });
    } catch (err) {
      this.logFail(req, 'update', err, `id=${id}`);
      if (err instanceof ServiceInputError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update agent' });
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const ok = await this.agents.delete(id, orgId);
      if (!ok) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      this.logOk(req, 'delete', `id=${id}`);
      res.json({ deleted: true });
    } catch (err) {
      this.logFail(req, 'delete', err, `id=${id}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete agent' });
    }
  };

  listProfiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.agents.listProfiles();
      this.logOk(req, 'listProfiles', `count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'listProfiles', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list profiles' });
    }
  };
}
