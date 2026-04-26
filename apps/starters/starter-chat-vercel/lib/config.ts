const SKILL_VAR_PREFIX = 'SKILL_VAR_';

function collectSkillRenderContext(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(SKILL_VAR_PREFIX) || value === undefined) continue;
    out[key.slice(SKILL_VAR_PREFIX.length)] = value;
  }
  return out;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  title: process.env.NEXT_PUBLIC_APP_TITLE || 'Starter Chat (Vercel)',
  agent: {
    name: process.env.NEXT_PUBLIC_AGENT_NAME || 'Suzie',
    description: process.env.AGENT_DESCRIPTION || 'OpenAI-compatible assistant',
    baseUrl: (process.env.AGENT_BASE_URL || 'http://localhost:4000').replace(/\/$/, ''),
    apiKey: process.env.AGENT_API_KEY || undefined,
    model: process.env.AGENT_MODEL || 'openai/gpt-4.1-mini',
  },
  vectorDb: {
    baseUrl: (process.env.VECTOR_DB_BASE_URL || 'http://localhost:3006').replace(/\/$/, ''),
    apiKey: process.env.VECTOR_DB_API_KEY || undefined,
  },
  tools: {
    maxIterations: parseInt(process.env.TOOL_MAX_ITERATIONS || '6', 10),
    /** Hosts the http_request tool may call. Auto-extended with skill-render-context URL hosts. */
    allowedHttpHosts: parseList(process.env.HTTP_ALLOWED_HOSTS),
  },
  skills: {
    /** Vercel mode is HTTP-catalog only — no filesystem skills directory. */
    catalogUrl: process.env.SKILL_CATALOG_URL || undefined,
    catalogToken: process.env.SKILL_CATALOG_TOKEN || undefined,
    allow: parseList(process.env.SKILLS_ALLOW),
    renderContext: collectSkillRenderContext(),
  },
  mcp: {
    /** Inline JSON using Claude Desktop's `mcpServers` shape. HTTP-transport servers only. */
    configJson: process.env.MCP_CONFIG_JSON || undefined,
  },
};
