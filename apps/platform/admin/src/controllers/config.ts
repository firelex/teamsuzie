import type { Request, Response } from 'express';
import { AuditLog, getRequestActor, type ConfigCategory, type Scope } from '@teamsuzie/shared-auth';
import { getSession } from '../middleware/auth.js';
import { ConfigService, ServiceInputError, type ScopeRef } from '../services/config.js';

const VALID_SCOPES: ReadonlyArray<Scope> = ['global', 'org', 'user', 'agent'];
const VALID_CATEGORIES: ReadonlyArray<ConfigCategory> = [
  'infrastructure',
  'ai',
  'oauth',
  'platform',
  'service',
];

function asObject(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function parseScope(raw: unknown): Scope | null {
  return typeof raw === 'string' && VALID_SCOPES.includes(raw as Scope) ? (raw as Scope) : null;
}

/**
 * Build a hierarchy from the query string. If `scope` is provided, the
 * hierarchy is that scope (with optional scope_id) followed by the broader
 * scopes up to global. If no scope is provided, hierarchy is just global.
 */
function hierarchyFromQuery(req: Request): ScopeRef[] | { error: string } {
  const scope = parseScope(req.query.scope);
  if (!scope) return [{ scope: 'global', scope_id: null }];

  const scopeIdRaw = req.query.scope_id;
  const scope_id = typeof scopeIdRaw === 'string' && scopeIdRaw.trim() ? scopeIdRaw.trim() : null;

  if (scope !== 'global' && !scope_id) {
    return { error: `scope_id is required when scope=${scope}` };
  }

  // Walk up from the requested scope through broader scopes.
  const out: ScopeRef[] = [{ scope, scope_id }];
  if (scope === 'agent' || scope === 'user' || scope === 'org') {
    out.push({ scope: 'global', scope_id: null });
  }
  return out;
}

export class ConfigController {
  constructor(private readonly service: ConfigService) {}

  private logOk(req: Request, action: string, extra = ''): void {
    const actor = getRequestActor(req);
    console.log(
      `[admin.config.${action}] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''}`,
    );
  }

  private logFail(req: Request, action: string, err: unknown, extra = ''): void {
    const actor = getRequestActor(req);
    console.error(
      `[admin.config.${action}] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''} err=${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async writeAudit(
    actorId: string | null,
    action: 'config.create' | 'config.update' | 'config.delete',
    resourceKey: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await AuditLog.create({
        actor_type: 'user',
        actor_id: actorId,
        action,
        resource_type: 'config_value',
        resource_id: null,
        details: { key: resourceKey, ...details },
      } as Partial<AuditLog>);
    } catch (err) {
      console.warn(
        `[admin.config.audit] write failed action=${action} key=${resourceKey} err=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  listDefinitions = async (req: Request, res: Response): Promise<void> => {
    try {
      const rawCategory = req.query.category;
      const category =
        typeof rawCategory === 'string' && VALID_CATEGORIES.includes(rawCategory as ConfigCategory)
          ? (rawCategory as ConfigCategory)
          : undefined;
      const items = await this.service.listDefinitions(category);
      this.logOk(req, 'listDefinitions', `count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'listDefinitions', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list definitions' });
    }
  };

  listValues = async (req: Request, res: Response): Promise<void> => {
    try {
      const hierarchy = hierarchyFromQuery(req);
      if ('error' in hierarchy) {
        res.status(400).json({ error: hierarchy.error });
        return;
      }
      const rawCategory = req.query.category;
      const category =
        typeof rawCategory === 'string' && VALID_CATEGORIES.includes(rawCategory as ConfigCategory)
          ? (rawCategory as ConfigCategory)
          : undefined;
      const values = await this.service.resolveAll(hierarchy, {
        category,
        redactSensitive: true,
      });
      this.logOk(
        req,
        'listValues',
        `scope=${hierarchy[0].scope} scope_id=${hierarchy[0].scope_id ?? '-'} count=${values.length}`,
      );
      res.json({ values });
    } catch (err) {
      this.logFail(req, 'listValues', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list values' });
    }
  };

  getValue = async (req: Request, res: Response): Promise<void> => {
    const key = String(req.params.key);
    try {
      const hierarchy = hierarchyFromQuery(req);
      if ('error' in hierarchy) {
        res.status(400).json({ error: hierarchy.error });
        return;
      }
      const config = await this.service.resolve(key, hierarchy, { redactSensitive: true });
      if (!config) {
        res.status(404).json({ error: 'Config key not found' });
        return;
      }
      this.logOk(req, 'getValue', `key=${key} source=${config.source_scope}`);
      res.json({ config });
    } catch (err) {
      this.logFail(req, 'getValue', err, `key=${key}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load value' });
    }
  };

  setValue = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const key = String(req.params.key);
    const body = asObject(req.body);
    if (!body) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const scope = parseScope(body.scope ?? 'global');
    if (!scope) {
      res.status(400).json({ error: `scope must be one of: ${VALID_SCOPES.join(', ')}` });
      return;
    }
    const scope_id = body.scope_id == null ? null : String(body.scope_id);
    if (scope !== 'global' && !scope_id) {
      res.status(400).json({ error: `scope_id is required when scope=${scope}` });
      return;
    }
    if (typeof body.value !== 'string') {
      res.status(400).json({ error: 'value must be a string' });
      return;
    }

    try {
      const result = await this.service.setValue({
        key,
        scope,
        scope_id,
        value: body.value,
        actorId: session.userId!,
      });
      await this.writeAudit(session.userId ?? null, 'config.update', key, {
        scope,
        scope_id,
        is_sensitive: result.definition.is_sensitive,
      });
      this.logOk(req, 'setValue', `key=${key} scope=${scope} scope_id=${scope_id ?? '-'}`);
      res.json({ config: result });
    } catch (err) {
      this.logFail(req, 'setValue', err, `key=${key} scope=${scope}`);
      if (err instanceof ServiceInputError) {
        res.status(err.code === 'NOT_FOUND' ? 404 : 400).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set value' });
    }
  };

  unsetValue = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const key = String(req.params.key);
    const scope = parseScope(req.query.scope) ?? 'global';
    const scopeIdRaw = req.query.scope_id;
    const scope_id = typeof scopeIdRaw === 'string' && scopeIdRaw.trim() ? scopeIdRaw.trim() : null;
    if (scope !== 'global' && !scope_id) {
      res.status(400).json({ error: `scope_id is required when scope=${scope}` });
      return;
    }

    try {
      const deleted = await this.service.unsetValue({ key, scope, scope_id });
      if (!deleted) {
        res.status(404).json({ error: 'No value set at that scope' });
        return;
      }
      await this.writeAudit(session.userId ?? null, 'config.delete', key, { scope, scope_id });
      this.logOk(req, 'unsetValue', `key=${key} scope=${scope} scope_id=${scope_id ?? '-'}`);
      res.json({ deleted: true });
    } catch (err) {
      this.logFail(req, 'unsetValue', err, `key=${key} scope=${scope}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to unset value' });
    }
  };
}
