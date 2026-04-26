import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApprovalQueue, InMemoryApprovalStore } from '@teamsuzie/approvals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { runChatTurn, type ChatStreamEvent } from '../chat-provider.js';
import { connectMcpServers, parseMcpConfigText } from '../mcp.js';
import { tools as builtInTools } from '../tools/index.js';
import type { ToolContext } from '../tools/index.js';

function sseResponse(events: object[]): Response {
  const text =
    events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

interface FakeFetchScript {
  match: (url: string) => boolean;
  respond: () => Response;
}

function fakeFetch(scripts: FakeFetchScript[]): { fetch: typeof fetch } {
  const queue = [...scripts];
  const fn = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const idx = queue.findIndex((s) => s.match(url));
    if (idx === -1) throw new Error(`No script matched ${url}`);
    const [script] = queue.splice(idx, 1);
    return script.respond();
  }) as typeof fetch;
  return { fetch: fn };
}

describe('parseMcpConfigText', () => {
  it('parses a stdio entry', () => {
    const servers = parseMcpConfigText(
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
            env: { NODE_ENV: 'test' },
          },
        },
      }),
    );
    expect(servers).toEqual([
      {
        name: 'filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { NODE_ENV: 'test' },
        cwd: undefined,
      },
    ]);
  });

  it('parses an http entry', () => {
    const servers = parseMcpConfigText(
      JSON.stringify({
        mcpServers: {
          'internal-api': {
            url: 'https://mcp.internal/mcp',
            headers: { authorization: 'Bearer xyz' },
          },
        },
      }),
    );
    expect(servers).toEqual([
      {
        name: 'internal-api',
        url: 'https://mcp.internal/mcp',
        headers: { authorization: 'Bearer xyz' },
      },
    ]);
  });

  it('rejects entries with both command and url', () => {
    expect(() =>
      parseMcpConfigText(
        JSON.stringify({
          mcpServers: { broken: { command: 'x', url: 'http://y' } },
        }),
      ),
    ).toThrow(/both command and url/);
  });

  it('rejects entries with neither command nor url', () => {
    expect(() =>
      parseMcpConfigText(JSON.stringify({ mcpServers: { broken: {} } })),
    ).toThrow(/neither command nor url/);
  });

  it('rejects unsafe server names', () => {
    expect(() =>
      parseMcpConfigText(
        JSON.stringify({ mcpServers: { 'has spaces': { command: 'x' } } }),
      ),
    ).toThrow(/invalid/i);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseMcpConfigText('{ not json')).toThrow(/not valid JSON/);
  });

  it('returns an empty list when mcpServers is missing', () => {
    expect(parseMcpConfigText('{}')).toEqual([]);
  });
});

describe('MCP client manager (in-memory)', () => {
  it('connects to an in-memory MCP server, exposes its tool prefixed, dispatches tool_calls', async () => {
    const server = new McpServer({ name: 'test-server', version: '0.1.0' });
    let receivedArgs: { message: string } | undefined;
    server.registerTool(
      'echo',
      {
        description: 'Echoes the message back.',
        inputSchema: { message: z.string() },
      },
      async ({ message }) => {
        receivedArgs = { message };
        return { content: [{ type: 'text', text: `echo: ${message}` }] };
      },
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const manager = await connectMcpServers({
      servers: [{ name: 'demo', command: 'unused' }],
      transportOverrides: { demo: clientTransport },
    });

    expect(manager.status).toEqual([
      { name: 'demo', connected: true, toolCount: 1 },
    ]);
    expect(manager.tools.map((t) => t.name)).toEqual(['demo__echo']);
    expect(manager.tools[0].description).toBe('Echoes the message back.');

    const { fetch: stub } = fakeFetch([
      {
        match: (url) => url === 'http://model.test/v1/chat/completions',
        respond: () =>
          sseResponse([
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call_echo',
                        function: {
                          name: 'demo__echo',
                          arguments: '{"message":"hi"}',
                        },
                      },
                    ],
                  },
                },
              ],
            },
            { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
          ]),
      },
      {
        match: (url) => url === 'http://model.test/v1/chat/completions',
        respond: () =>
          sseResponse([
            { choices: [{ delta: { content: 'echoed.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ]),
      },
    ]);

    const toolCtx: ToolContext = {
      approvals: new ApprovalQueue({ store: new InMemoryApprovalStore() }),
      vectorDbBaseUrl: 'http://unused',
      allowedHttpHosts: [],
      fetchImpl: stub,
    };

    const events: ChatStreamEvent[] = [];
    for await (const event of runChatTurn({
      agent: {
        name: 'Test',
        description: '',
        baseUrl: 'http://model.test',
        apiKey: undefined,
        model: 'test-model',
      },
      messages: [{ role: 'user', content: 'echo hi' }],
      tools: [...builtInTools, ...manager.tools],
      toolCtx,
      fetchImpl: stub,
    })) {
      events.push(event);
    }

    const toolResult = events.find((e) => e.type === 'tool_result') as Extract<
      ChatStreamEvent,
      { type: 'tool_result' }
    >;
    expect(toolResult).toBeDefined();
    expect(toolResult.name).toBe('demo__echo');
    expect((toolResult.result as { text: string }).text).toBe('echo: hi');
    expect(receivedArgs).toEqual({ message: 'hi' });

    expect(events[events.length - 1].type).toBe('done');

    await manager.shutdown();
    await server.close();
  });

  it('records connection failures per-server without aborting the whole bootstrap', async () => {
    const server = new McpServer({ name: 'good-server', version: '0.1.0' });
    server.registerTool(
      'ping',
      { description: 'Ping' },
      async () => ({ content: [{ type: 'text', text: 'pong' }] }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    // Bad transport: throws on start.
    const badTransport = {
      onclose: undefined,
      onerror: undefined,
      onmessage: undefined,
      async start() {
        throw new Error('boom');
      },
      async close() {},
      async send() {},
    };

    const manager = await connectMcpServers({
      servers: [
        { name: 'good', command: 'unused' },
        { name: 'bad', command: 'unused' },
      ],
      transportOverrides: { good: clientTransport, bad: badTransport as never },
    });

    expect(manager.status.find((s) => s.name === 'good')?.connected).toBe(true);
    const badStatus = manager.status.find((s) => s.name === 'bad');
    expect(badStatus?.connected).toBe(false);
    expect(badStatus?.error).toMatch(/boom/);
    expect(manager.tools.map((t) => t.name)).toEqual(['good__ping']);

    await manager.shutdown();
    await server.close();
  });
});
