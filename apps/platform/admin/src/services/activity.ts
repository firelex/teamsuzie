import { Agent, AuditLog, User } from '@teamsuzie/shared-auth';
import { Op, fn, col, literal } from 'sequelize';
import { UsageEvent } from '../models/usage-event.js';

export type ActorTypeFilter = 'user' | 'agent' | 'system';

export interface ActivityFilters {
  /** Match rows whose action starts with this prefix — e.g. "approval." or "config." */
  actionPrefix?: string;
  resourceType?: string;
  actorType?: ActorTypeFilter;
  actorId?: string;
  /** ISO date string — inclusive lower bound. */
  since?: string;
  /** ISO date string — inclusive upper bound. */
  until?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityRow {
  id: string;
  timestamp: Date;
  actor_type: string;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
}

export interface ActiveAgentRow {
  id: string;
  name: string;
  last_active_at: Date | null;
  status: string;
}

export interface UsageFilters {
  agentId?: string;
  service?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface UsageRow {
  id: string;
  timestamp: Date;
  service: string;
  operation: string;
  model: string | null;
  input_units: number;
  output_units: number;
  cost_estimate: number;
  agent_id: string | null;
  agent_name: string | null;
  request_id: string | null;
}

export interface UsageSummary {
  input_units: number;
  output_units: number;
  total_units: number;
  cost_estimate: number;
  request_count: number;
}

export interface UsageServiceBreakdown extends UsageSummary {
  service: string;
}

export interface UsageSummaryResponse {
  range: { from: string | null; to: string | null };
  total: UsageSummary;
  by_service: UsageServiceBreakdown[];
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class ActivityService {
  async list(
    organizationId: string | null,
    filters: ActivityFilters,
  ): Promise<{ items: ActivityRow[]; total: number }> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = filters.offset ?? 0;

    const where: Record<string, unknown> = {};
    if (filters.actionPrefix) {
      where.action = { [Op.like]: `${filters.actionPrefix}%` };
    }
    if (filters.resourceType) where.resource_type = filters.resourceType;
    if (filters.actorType) where.actor_type = filters.actorType;
    if (filters.actorId) where.actor_id = filters.actorId;
    if (filters.since || filters.until) {
      const ts: Record<string | symbol, unknown> = {};
      if (filters.since) ts[Op.gte] = new Date(filters.since);
      if (filters.until) ts[Op.lte] = new Date(filters.until);
      where.timestamp = ts;
    }

    const [rows, total] = await Promise.all([
      AuditLog.findAll({
        where,
        order: [['timestamp', 'DESC']],
        limit,
        offset,
      }),
      AuditLog.count({ where }),
    ]);

    const actorIds = Array.from(
      new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v)),
    );
    const users = await User.findAll({
      where: { id: actorIds },
      attributes: ['id', 'email', 'name'],
    });
    const agents = await Agent.findAll({
      where: { id: actorIds, ...(organizationId ? { organization_id: organizationId } : {}) },
      attributes: ['id', 'name'],
    });
    const userById = new Map(users.map((u) => [u.id, `${u.email}`]));
    const agentById = new Map(agents.map((a) => [a.id, a.name]));

    const items: ActivityRow[] = rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      actor_label:
        r.actor_id == null
          ? null
          : r.actor_type === 'agent'
            ? (agentById.get(r.actor_id) ?? null)
            : (userById.get(r.actor_id) ?? null),
      action: r.action,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      details: (r.details ?? null) as Record<string, unknown> | null,
    }));

    return { items, total };
  }

  async recentlyActiveAgents(
    organizationId: string,
    limit = 5,
  ): Promise<ActiveAgentRow[]> {
    const agents = await Agent.findAll({
      where: {
        organization_id: organizationId,
        last_active_at: { [Op.ne]: null },
      },
      order: [['last_active_at', 'DESC']],
      limit,
      attributes: ['id', 'name', 'last_active_at', 'status'],
    });
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      last_active_at: a.last_active_at,
      status: a.status,
    }));
  }

  async listUsage(
    organizationId: string | null,
    filters: UsageFilters,
  ): Promise<{ items: UsageRow[]; total: number }> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = filters.offset ?? 0;

    const where = this.buildUsageWhere(organizationId, filters);

    const [rows, total] = await Promise.all([
      UsageEvent.findAll({
        where,
        order: [['timestamp', 'DESC']],
        limit,
        offset,
      }),
      UsageEvent.count({ where }),
    ]);

    const agentIds = Array.from(
      new Set(rows.map((r) => r.agent_id).filter((v): v is string => !!v)),
    );
    const agents = await Agent.findAll({
      where: { id: agentIds },
      attributes: ['id', 'name'],
    });
    const agentById = new Map(agents.map((a) => [a.id, a.name]));

    const items: UsageRow[] = rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      service: r.service,
      operation: r.operation,
      model: r.model,
      input_units: r.input_units,
      output_units: r.output_units,
      cost_estimate: Number(r.cost_estimate),
      agent_id: r.agent_id,
      agent_name: r.agent_id ? (agentById.get(r.agent_id) ?? null) : null,
      request_id: r.request_id,
    }));

    return { items, total };
  }

  async usageSummary(
    organizationId: string | null,
    filters: Pick<UsageFilters, 'agentId' | 'service' | 'since' | 'until'>,
  ): Promise<UsageSummaryResponse> {
    const where = this.buildUsageWhere(organizationId, filters);

    const totalsRaw = (await UsageEvent.findOne({
      where,
      attributes: [
        [fn('COALESCE', fn('SUM', col('input_units')), 0), 'input_units'],
        [fn('COALESCE', fn('SUM', col('output_units')), 0), 'output_units'],
        [fn('COALESCE', fn('SUM', col('cost_estimate')), 0), 'cost_estimate'],
        [fn('COUNT', literal('*')), 'request_count'],
      ],
      raw: true,
    })) as unknown as Record<string, string | number> | null;

    const byServiceRaw = (await UsageEvent.findAll({
      where,
      attributes: [
        'service',
        [fn('COALESCE', fn('SUM', col('input_units')), 0), 'input_units'],
        [fn('COALESCE', fn('SUM', col('output_units')), 0), 'output_units'],
        [fn('COALESCE', fn('SUM', col('cost_estimate')), 0), 'cost_estimate'],
        [fn('COUNT', literal('*')), 'request_count'],
      ],
      group: ['service'],
      raw: true,
    })) as unknown as Record<string, string | number>[];

    const totals = totalsRaw ?? {};
    const input_units = Number(totals.input_units ?? 0);
    const output_units = Number(totals.output_units ?? 0);
    const cost_estimate = Number(totals.cost_estimate ?? 0);
    const request_count = Number(totals.request_count ?? 0);

    return {
      range: {
        from: filters.since ?? null,
        to: filters.until ?? null,
      },
      total: {
        input_units,
        output_units,
        total_units: input_units + output_units,
        cost_estimate,
        request_count,
      },
      by_service: byServiceRaw.map((row) => {
        const input = Number(row.input_units ?? 0);
        const output = Number(row.output_units ?? 0);
        return {
          service: String(row.service),
          input_units: input,
          output_units: output,
          total_units: input + output,
          cost_estimate: Number(row.cost_estimate ?? 0),
          request_count: Number(row.request_count ?? 0),
        };
      }),
    };
  }

  private buildUsageWhere(
    organizationId: string | null,
    filters: UsageFilters,
  ): Record<string | symbol, unknown> {
    const where: Record<string | symbol, unknown> = {};
    if (organizationId) where.organization_id = organizationId;
    if (filters.agentId) where.agent_id = filters.agentId;
    if (filters.service) where.service = filters.service;
    if (filters.since || filters.until) {
      const ts: Record<string | symbol, unknown> = {};
      if (filters.since) ts[Op.gte] = new Date(filters.since);
      if (filters.until) ts[Op.lte] = new Date(filters.until);
      where.timestamp = ts;
    }
    return where;
  }
}
