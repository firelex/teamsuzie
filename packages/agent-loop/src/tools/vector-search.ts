import type { ToolDefinition } from './types.js';

interface VectorSearchArgs {
  query: string;
  scope?: 'global' | 'org' | 'agent';
  scope_id?: string | null;
  limit?: number;
}

interface VectorDbResponse {
  success: boolean;
  data?: unknown[];
  error?: string;
}

export const vectorSearchTool: ToolDefinition<VectorSearchArgs> = {
  name: 'vector_search',
  description:
    'Search the scoped knowledge base for passages relevant to a query. Use this whenever the user asks about content stored in the knowledge base — policies, docs, prior conversations, anything indexed.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language query.',
      },
      scope: {
        type: 'string',
        enum: ['global', 'org', 'agent'],
        description: 'Scope to search. Defaults to global.',
      },
      scope_id: {
        type: ['string', 'null'],
        description: 'Scope id. Use null for global; required for org or agent scope.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'Max results (default 5).',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const fetcher = ctx.fetchImpl ?? fetch;
    const scope = args.scope ?? 'global';
    const scope_id = scope === 'global' ? null : args.scope_id ?? null;
    const limit = args.limit ?? 5;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ctx.vectorDbApiKey) headers['X-Agent-API-Key'] = ctx.vectorDbApiKey;

    const response = await fetcher(`${ctx.vectorDbBaseUrl}/api/v1/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: args.query,
        scopes: [{ scope, scope_id }],
        limit,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`vector-db returned ${response.status}: ${text.slice(0, 200)}`);
    }

    const body = (await response.json()) as VectorDbResponse;
    if (!body.success) {
      throw new Error(body.error || 'vector-db search failed');
    }

    return { results: body.data ?? [] };
  },
};
