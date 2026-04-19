import 'dotenv/config';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  apiKey?: string;
  openclawAgentId?: string;
}

function parseAgents(raw: string | undefined): AgentConfig[] {
  if (!raw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('CHAT_AGENTS must be a JSON array');
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`CHAT_AGENTS[${index}] must be an object`);
      }

      const candidate = item as Record<string, unknown>;
      const id = String(candidate.id ?? '').trim();
      const name = String(candidate.name ?? '').trim();
      const baseUrl = String(candidate.baseUrl ?? '').trim().replace(/\/$/, '');

      if (!id || !name || !baseUrl) {
        throw new Error(`CHAT_AGENTS[${index}] requires id, name, and baseUrl`);
      }

      return {
        id,
        name,
        description: typeof candidate.description === 'string' ? candidate.description : undefined,
        baseUrl,
        apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : undefined,
        openclawAgentId:
          typeof candidate.openclawAgentId === 'string' ? candidate.openclawAgentId : undefined,
      };
    });
  } catch (error) {
    throw new Error(
      `Failed to parse CHAT_AGENTS: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export const config = {
  port: parseInt(process.env.ADMIN_PORT || '3008', 10),
  publicUrl: (process.env.ADMIN_PUBLIC_URL || 'http://localhost:3008').replace(/\/$/, ''),
  allowedOrigin: process.env.ADMIN_ALLOWED_ORIGIN || 'http://localhost:5175',
  agents: parseAgents(process.env.CHAT_AGENTS),
};
