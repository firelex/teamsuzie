import { randomUUID } from 'node:crypto';
import { Agent } from '@teamsuzie/shared-auth';
import type { AgentConfig } from '../config.js';
import { config } from '../config.js';
import { OpenClawClient, type ChatMessage } from './openclaw-client.js';
import type { AdminAgentConfig } from './agents.js';

export type AgentSource = 'db' | 'env';

export interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  running: boolean;
  source: AgentSource;
}

interface ResolvedAgent extends AgentConfig {
  source: AgentSource;
  /** Optional system prompt to inject at conversation start (DB agents only). */
  system_prompt?: string;
}

function dbAgentToResolved(agent: Agent): ResolvedAgent | null {
  const cfg = (agent.config ?? {}) as AdminAgentConfig;
  const baseUrl = typeof cfg.baseUrl === 'string' ? cfg.baseUrl.replace(/\/$/, '') : '';
  if (!baseUrl) {
    return null;
  }
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? undefined,
    baseUrl,
    apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey : undefined,
    openclawAgentId: typeof cfg.openclawAgentId === 'string' ? cfg.openclawAgentId : undefined,
    system_prompt: typeof cfg.system_prompt === 'string' ? cfg.system_prompt : undefined,
    source: 'db',
  };
}

function envAgentToResolved(agent: AgentConfig): ResolvedAgent {
  return { ...agent, source: 'env' };
}

export class ChatProxyService {
  private readonly openClawClient = new OpenClawClient();
  private readonly sessionKeys = new Map<string, string>();

  /**
   * Merge DB-managed agents with env-configured CHAT_AGENTS. DB entries win on id
   * collisions so an operator can shadow an env agent by creating one with the
   * same id (rare — DB ids are UUIDs, env ids are operator-chosen strings).
   */
  private async resolveAll(): Promise<ResolvedAgent[]> {
    const dbAgents: ResolvedAgent[] = [];
    try {
      const rows = await Agent.findAll({ where: { status: 'active' } });
      for (const row of rows) {
        const resolved = dbAgentToResolved(row);
        if (resolved) dbAgents.push(resolved);
      }
    } catch {
      // DB unreachable — fall back to env-only. Surface via /api/health later if needed.
    }
    const dbIds = new Set(dbAgents.map((a) => a.id));
    const envAgents = config.agents
      .filter((a) => !dbIds.has(a.id))
      .map(envAgentToResolved);
    return [...dbAgents, ...envAgents];
  }

  private async resolveOne(agentId: string): Promise<ResolvedAgent> {
    try {
      const row = await Agent.findByPk(agentId);
      if (row && row.status === 'active') {
        const resolved = dbAgentToResolved(row);
        if (resolved) return resolved;
      }
    } catch {
      // Ignore and fall through to env.
    }
    const env = config.agents.find((a) => a.id === agentId);
    if (env) return envAgentToResolved(env);
    throw new Error(`Unknown agent: ${agentId}`);
  }

  async listAgents(): Promise<AgentInfo[]> {
    const resolved = await this.resolveAll();
    return Promise.all(
      resolved.map(async (agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        running: await this.openClawClient.checkHealth(agent),
        source: agent.source,
      })),
    );
  }

  getOrCreateSession(connectionId: string): string {
    let sessionKey = this.sessionKeys.get(connectionId);
    if (!sessionKey) {
      sessionKey = randomUUID();
      this.sessionKeys.set(connectionId, sessionKey);
    }
    return sessionKey;
  }

  clearSession(connectionId: string): void {
    this.sessionKeys.delete(connectionId);
  }

  async *chatCompletionStream(
    agentId: string,
    messages: ChatMessage[],
    connectionId: string,
  ): AsyncGenerator<string, void, unknown> {
    const agent = await this.resolveOne(agentId);
    const sessionKey = this.getOrCreateSession(connectionId);

    // Inject the agent's system prompt (if any) as the first message for DB agents.
    // Env agents don't carry a system prompt today; they rely on the runtime's own config.
    const preparedMessages: ChatMessage[] =
      agent.source === 'db' && agent.system_prompt
        ? [{ role: 'system', content: agent.system_prompt }, ...messages]
        : messages;

    const reader = await this.openClawClient.chatCompletionStream(agent, preparedMessages, sessionKey);
    yield* this.openClawClient.readTextStream(reader);
  }
}

export type { ChatMessage };
