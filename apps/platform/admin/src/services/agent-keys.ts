import {
  Agent,
  AgentApiKey,
  User,
  generateApiKey,
  type ApiKeyScope,
} from '@teamsuzie/shared-auth';

export interface AgentKeySummary {
  id: string;
  agent_id: string;
  agent_name: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute: number;
  last_used_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  revoked_at: Date | null;
  created_at: Date;
}

export interface CreateAgentKeyInput {
  agent_id: string;
  name: string;
  scopes?: ApiKeyScope[];
  rate_limit_per_minute?: number;
  expires_in_days?: number | null;
}

export interface CreateAgentKeyResult {
  /** The plaintext key — shown ONCE at creation. Never retrievable again. */
  key: string;
  summary: AgentKeySummary;
}

export class ServiceInputError extends Error {
  readonly code: string;
  constructor(message: string, code = 'INVALID_INPUT') {
    super(message);
    this.code = code;
    this.name = 'ServiceInputError';
  }
}

function serialize(row: AgentApiKey, agentName: string): AgentKeySummary {
  return {
    id: row.id,
    agent_id: row.agent_id,
    agent_name: agentName,
    name: row.name,
    key_prefix: row.key_prefix,
    scopes: row.scopes,
    rate_limit_per_minute: row.rate_limit_per_minute,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    is_active: row.is_active,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
  };
}

export class AgentKeysService {
  async resolveOrgId(userId: string): Promise<string | null> {
    const user = await User.findByPk(userId);
    return user?.default_organization_id ?? null;
  }

  async list(organizationId: string): Promise<AgentKeySummary[]> {
    const agents = await Agent.findAll({
      where: { organization_id: organizationId },
      attributes: ['id', 'name'],
    });
    const agentIds = agents.map((a) => a.id);
    const agentNameById = new Map(agents.map((a) => [a.id, a.name]));
    if (agentIds.length === 0) return [];

    const keys = await AgentApiKey.findAll({
      where: { agent_id: agentIds },
      order: [['created_at', 'DESC']],
    });
    return keys.map((k) => serialize(k, agentNameById.get(k.agent_id) ?? '(unknown)'));
  }

  async create(
    input: CreateAgentKeyInput,
    context: { userId: string; organizationId: string },
  ): Promise<CreateAgentKeyResult> {
    const name = input.name.trim();
    if (!name) throw new ServiceInputError('name is required');

    const agent = await Agent.findOne({
      where: { id: input.agent_id, organization_id: context.organizationId },
    });
    if (!agent) throw new ServiceInputError('Unknown agent_id for this organization', 'NOT_FOUND');

    const { key, prefix, hash } = generateApiKey('dtk');
    const expires_at =
      input.expires_in_days && input.expires_in_days > 0
        ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
        : null;

    const created = await AgentApiKey.create({
      agent_id: agent.id,
      name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: input.scopes ?? [],
      rate_limit_per_minute: input.rate_limit_per_minute ?? 60,
      expires_at,
      is_active: true,
      created_by: context.userId,
      updated_by: context.userId,
    } as Partial<AgentApiKey>);

    return { key, summary: serialize(created, agent.name) };
  }

  async revoke(
    id: string,
    context: { userId: string; organizationId: string },
  ): Promise<AgentKeySummary | null> {
    const key = await AgentApiKey.findByPk(id);
    if (!key) return null;
    const agent = await Agent.findOne({
      where: { id: key.agent_id, organization_id: context.organizationId },
    });
    if (!agent) return null;

    if (!key.is_active && key.revoked_at) {
      return serialize(key, agent.name);
    }

    key.is_active = false;
    key.revoked_at = new Date();
    key.revoked_by = context.userId;
    key.updated_by = context.userId;
    await key.save();
    return serialize(key, agent.name);
  }
}
