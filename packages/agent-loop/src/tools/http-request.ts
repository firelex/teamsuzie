import type { ToolDefinition } from './types.js';

interface HttpRequestArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeout_ms?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BODY_CHARS = 16_000;

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isHostAllowed(host: string, allowedHosts: string[]): boolean {
  const target = host.toLowerCase();
  return allowedHosts.some((entry) => entry.toLowerCase() === target);
}

export const httpRequestTool: ToolDefinition<HttpRequestArgs> = {
  name: 'http_request',
  description:
    'Make an HTTP request to an allow-listed host. Use this to call services described in installed skills (e.g. spreadsheet generation, presentation generation, custom internal APIs). The host of the URL must be on the allow-list configured by the operator — otherwise the call is refused.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Full URL to request, including scheme and host.',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        description: 'HTTP method. Defaults to GET.',
      },
      headers: {
        type: 'object',
        description: 'Optional request headers.',
        additionalProperties: { type: 'string' },
      },
      body: {
        description:
          'Request body. Pass a JSON object for application/json calls, or a string for raw bodies.',
      },
      timeout_ms: {
        type: 'integer',
        minimum: 1000,
        maximum: 120000,
        description: 'Request timeout in milliseconds. Default 30000.',
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const fetcher = ctx.fetchImpl ?? fetch;
    const allowedHosts = ctx.allowedHttpHosts ?? [];
    const host = hostFromUrl(args.url);

    if (!host) {
      throw new Error(`Invalid URL: ${args.url}`);
    }
    if (allowedHosts.length === 0) {
      throw new Error(
        'http_request is disabled: no hosts are on the allow-list. Set STARTER_CHAT_HTTP_ALLOWED_HOSTS or configure skill render-context URLs.',
      );
    }
    if (!isHostAllowed(host, allowedHosts)) {
      throw new Error(
        `http_request refused: host "${host}" is not on the allow-list. Allowed: ${allowedHosts.join(', ')}.`,
      );
    }

    const method = args.method ?? 'GET';
    const headers: Record<string, string> = { ...(args.headers ?? {}) };
    let body: string | undefined;

    if (args.body !== undefined && args.body !== null) {
      if (typeof args.body === 'string') {
        body = args.body;
      } else {
        body = JSON.stringify(args.body);
        if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
          headers['content-type'] = 'application/json';
        }
      }
    }

    const timeout = args.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    const response = await fetcher(args.url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const text = await response.text();
    const truncated = text.length > MAX_RESPONSE_BODY_CHARS;
    const bodyOut = truncated ? text.slice(0, MAX_RESPONSE_BODY_CHARS) : text;

    return {
      status: response.status,
      headers: responseHeaders,
      body: bodyOut,
      truncated,
    };
  },
};
