import type { Request, Response } from 'express';
import { getRequestActor } from '@teamsuzie/shared-auth';
import { getSession } from '../middleware/auth.js';
import {
  CONTENT_TYPES,
  ServiceInputError,
  WorkspaceService,
  type UpsertFileInput,
} from '../services/workspace.js';

function asObject(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  private logOk(req: Request, action: string, extra = ''): void {
    const actor = getRequestActor(req);
    console.log(
      `[admin.workspace.${action}] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''}`,
    );
  }

  private logFail(req: Request, action: string, err: unknown, extra = ''): void {
    const actor = getRequestActor(req);
    console.error(
      `[admin.workspace.${action}] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''} err=${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async resolveOrg(req: Request, res: Response): Promise<string | null> {
    const session = getSession(req);
    const orgId = await this.workspace.resolveOrgId(session.userId!);
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

      const rawAgentId = req.query.agent_id;
      let agentId: string | null | undefined;
      if (rawAgentId === undefined) {
        agentId = undefined;
      } else if (rawAgentId === '' || rawAgentId === 'null') {
        agentId = null;
      } else if (typeof rawAgentId === 'string') {
        agentId = rawAgentId;
      } else {
        res.status(400).json({ error: 'agent_id must be a single string' });
        return;
      }

      const items = await this.workspace.list(orgId, { agentId });
      const filterLabel = agentId === undefined ? 'any' : agentId === null ? 'null' : agentId;
      this.logOk(req, 'list', `agent_id=${filterLabel} count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'list', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list files' });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const file = await this.workspace.get(id, orgId);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      this.logOk(req, 'get', `id=${id}`);
      res.json({ file });
    } catch (err) {
      this.logFail(req, 'get', err, `id=${id}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load file' });
    }
  };

  upsert = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const body = asObject(req.body);
    if (!body) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const file_path = typeof body.file_path === 'string' ? body.file_path.trim() : '';
    const content = typeof body.content === 'string' ? body.content : '';
    const content_type = typeof body.content_type === 'string' ? body.content_type : 'markdown';
    const agent_id = body.agent_id == null ? null : String(body.agent_id);

    if (!file_path) {
      res.status(400).json({ error: 'file_path is required' });
      return;
    }
    if (typeof body.content !== 'string') {
      res.status(400).json({ error: 'content must be a string' });
      return;
    }
    if (!CONTENT_TYPES.includes(content_type as (typeof CONTENT_TYPES)[number])) {
      res
        .status(400)
        .json({ error: `content_type must be one of: ${CONTENT_TYPES.join(', ')}` });
      return;
    }

    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;

      const input: UpsertFileInput = {
        agent_id,
        file_path,
        content,
        content_type: content_type as (typeof CONTENT_TYPES)[number],
      };
      const result = await this.workspace.upsert(input, {
        userId: session.userId!,
        organizationId: orgId,
      });
      this.logOk(
        req,
        'upsert',
        `id=${result.file.id} path=${file_path} created=${result.created}`,
      );
      res.status(result.created ? 201 : 200).json({ file: result.file, created: result.created });
    } catch (err) {
      this.logFail(req, 'upsert', err, `path=${file_path}`);
      if (err instanceof ServiceInputError) {
        const status = err.code === 'NOT_FOUND' ? 404 : 400;
        res.status(status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save file' });
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    try {
      const orgId = await this.resolveOrg(req, res);
      if (!orgId) return;
      const ok = await this.workspace.delete(id, orgId);
      if (!ok) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      this.logOk(req, 'delete', `id=${id}`);
      res.json({ deleted: true });
    } catch (err) {
      this.logFail(req, 'delete', err, `id=${id}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete file' });
    }
  };
}
