import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { AnyToolDefinition } from './tools/index';

const TOOL_NAME_SEPARATOR = '__';

export interface StdioServerSpec {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface HttpServerSpec {
  url: string;
  headers?: Record<string, string>;
}

export type McpServerSpec = (StdioServerSpec | HttpServerSpec) & {
  /** Logical name used as a prefix for tool ids exposed to the model. */
  name: string;
};

export interface McpServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

export interface McpManager {
  tools: AnyToolDefinition[];
  status: McpServerStatus[];
  shutdown(): Promise<void>;
}

export interface ConnectMcpOptions {
  servers: McpServerSpec[];
  /** Inject a pre-built transport for a given server name. Used by tests. */
  transportOverrides?: Record<string, Transport>;
  clientName?: string;
  clientVersion?: string;
}

interface McpServerConfigFile {
  mcpServers?: Record<
    string,
    {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      url?: string;
      headers?: Record<string, string>;
    }
  >;
}

export function parseMcpConfigFile(path: string): McpServerSpec[] {
  const raw = fs.readFileSync(path, 'utf-8');
  return parseMcpConfigText(raw);
}

export function parseMcpConfigText(raw: string): McpServerSpec[] {
  let parsed: McpServerConfigFile;
  try {
    parsed = JSON.parse(raw) as McpServerConfigFile;
  } catch (err) {
    throw new Error(`MCP config is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }

  const entries = parsed.mcpServers ?? {};
  const servers: McpServerSpec[] = [];

  for (const [name, entry] of Object.entries(entries)) {
    if (!isSafeServerName(name)) {
      throw new Error(
        `MCP server name "${name}" is invalid. Use only letters, numbers, dash, and underscore (no spaces, no dots).`,
      );
    }
    if (entry.command && entry.url) {
      throw new Error(`MCP server "${name}" has both command and url — pick one transport.`);
    }
    if (entry.command) {
      servers.push({ name, command: entry.command, args: entry.args, env: entry.env, cwd: entry.cwd });
    } else if (entry.url) {
      servers.push({ name, url: entry.url, headers: entry.headers });
    } else {
      throw new Error(`MCP server "${name}" has neither command nor url.`);
    }
  }

  return servers;
}

function isSafeServerName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function isStdioSpec(spec: McpServerSpec): spec is McpServerSpec & StdioServerSpec {
  return 'command' in spec && typeof spec.command === 'string';
}

function isHttpSpec(spec: McpServerSpec): spec is McpServerSpec & HttpServerSpec {
  return 'url' in spec && typeof spec.url === 'string';
}

function buildTransport(spec: McpServerSpec): Transport {
  const name = spec.name;
  if (isStdioSpec(spec)) {
    return new StdioClientTransport({
      command: spec.command,
      args: spec.args,
      env: spec.env,
      cwd: spec.cwd,
    });
  }
  if (isHttpSpec(spec)) {
    return new StreamableHTTPClientTransport(new URL(spec.url), {
      requestInit: spec.headers ? { headers: spec.headers } : undefined,
    });
  }
  throw new Error(`MCP server "${name}" has neither stdio command nor http url.`);
}

interface CallToolContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

interface CallToolResultLike {
  content?: CallToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

function summarizeToolResult(result: CallToolResultLike): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const content = result.content ?? [];
  const textParts = content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text);
  if (textParts.length > 0) return { text: textParts.join('\n') };
  return { content };
}

export async function connectMcpServers(opts: ConnectMcpOptions): Promise<McpManager> {
  const clients: Client[] = [];
  const tools: AnyToolDefinition[] = [];
  const status: McpServerStatus[] = [];

  for (const spec of opts.servers) {
    const client = new Client({
      name: opts.clientName ?? 'starter-chat',
      version: opts.clientVersion ?? '0.1.0',
    });

    let transport: Transport;
    try {
      transport = opts.transportOverrides?.[spec.name] ?? buildTransport(spec);
    } catch (err) {
      status.push({
        name: spec.name,
        connected: false,
        toolCount: 0,
        error: err instanceof Error ? err.message : 'Failed to build transport',
      });
      continue;
    }

    try {
      await client.connect(transport);
      const list = await client.listTools();
      const wrapped = list.tools.map((t) => wrapMcpTool(client, spec.name, t));
      tools.push(...wrapped);
      clients.push(client);
      status.push({ name: spec.name, connected: true, toolCount: wrapped.length });
    } catch (err) {
      status.push({
        name: spec.name,
        connected: false,
        toolCount: 0,
        error: err instanceof Error ? err.message : 'Connect failed',
      });
      try {
        await transport.close();
      } catch {
        // ignore secondary close failure
      }
    }
  }

  return {
    tools,
    status,
    async shutdown() {
      await Promise.allSettled(clients.map((c) => c.close()));
    },
  };
}

interface McpToolListing {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

function wrapMcpTool(client: Client, serverName: string, tool: McpToolListing): AnyToolDefinition {
  const exposedName = `${serverName}${TOOL_NAME_SEPARATOR}${tool.name}`;
  return {
    name: exposedName,
    description: tool.description ?? `Tool "${tool.name}" exposed by MCP server "${serverName}".`,
    parameters: tool.inputSchema ?? {
      type: 'object',
      properties: {},
      additionalProperties: true,
    },
    async execute(args) {
      const result = (await client.callTool({
        name: tool.name,
        arguments: (args ?? {}) as Record<string, unknown>,
      })) as CallToolResultLike;

      if (result.isError) {
        const text =
          (result.content ?? [])
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text)
            .join('\n') || `MCP tool "${exposedName}" reported an error.`;
        throw new Error(text);
      }

      return summarizeToolResult(result);
    },
  };
}

export const MCP_TOOL_NAME_SEPARATOR = TOOL_NAME_SEPARATOR;
