import { randomUUID } from 'node:crypto';
import type { AgentConfig } from '../config.js';
import { config } from '../config.js';
import { OpenClawClient, type ChatMessage } from './openclaw-client.js';

export interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  running: boolean;
}

export class ChatProxyService {
  private readonly openClawClient = new OpenClawClient();
  private readonly sessionKeys = new Map<string, string>();

  listConfiguredAgents(): AgentConfig[] {
    return config.agents;
  }

  findAgent(agentId: string): AgentConfig {
    const agent = config.agents.find((candidate) => candidate.id === agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    return agent;
  }

  async listAgents(): Promise<AgentInfo[]> {
    return Promise.all(
      config.agents.map(async (agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        running: await this.openClawClient.checkHealth(agent),
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
    const agent = this.findAgent(agentId);
    const sessionKey = this.getOrCreateSession(connectionId);
    const reader = await this.openClawClient.chatCompletionStream(agent, messages, sessionKey);
    yield* this.openClawClient.readTextStream(reader);
  }
}

export type { ChatMessage };
