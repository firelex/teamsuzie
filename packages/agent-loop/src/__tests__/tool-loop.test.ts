import { describe, expect, it } from 'vitest';
import { ApprovalQueue, InMemoryApprovalStore } from '@teamsuzie/approvals';
import { runChatTurn, type ChatStreamEvent } from '../chat-provider.js';
import { tools } from '../tools/index.js';
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

interface FakeFetchScript {
  match: (url: string, init?: RequestInit) => boolean;
  respond: () => Response;
}

function fakeFetch(scripts: FakeFetchScript[]): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const queue = [...scripts];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    const idx = queue.findIndex((s) => s.match(url, init));
    if (idx === -1) {
      throw new Error(`No script matched fetch to ${url}`);
    }
    const [script] = queue.splice(idx, 1);
    return script.respond();
  }) as typeof fetch;
  return { fetch: fn, calls };
}

describe('runChatTurn tool-use loop', () => {
  const baseAgent = {
    name: 'Test',
    description: '',
    baseUrl: 'http://model.test',
    apiKey: undefined,
    model: 'test-model',
  };

  it('dispatches a vector_search tool call and feeds the result back into the next model call', async () => {
    const { fetch: stubFetch, calls } = fakeFetch([
      // 1st model call: emit a streaming tool_call for vector_search
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
                        id: 'call_abc',
                        function: { name: 'vector_search', arguments: '' },
                      },
                    ],
                  },
                },
              ],
            },
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        function: { arguments: '{"query":"refund policy"}' },
                      },
                    ],
                  },
                },
              ],
            },
            { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
          ]),
      },
      // vector-db call from inside the tool
      {
        match: (url) => url === 'http://vector.test/api/v1/search',
        respond: () =>
          jsonResponse({
            success: true,
            data: [{ id: 'doc-1', score: 0.91, text: 'Refunds within 30 days.' }],
            query: 'refund policy',
          }),
      },
      // 2nd model call: emit a final text response
      {
        match: (url) => url === 'http://model.test/v1/chat/completions',
        respond: () =>
          sseResponse([
            { choices: [{ delta: { content: 'Refunds are within 30 days.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ]),
      },
    ]);

    const approvals = new ApprovalQueue({ store: new InMemoryApprovalStore() });
    const toolCtx: ToolContext = {
      approvals,
      vectorDbBaseUrl: 'http://vector.test',
      fetchImpl: stubFetch,
    };

    const events: ChatStreamEvent[] = [];
    for await (const event of runChatTurn({
      agent: baseAgent,
      messages: [{ role: 'user', content: 'What is the refund policy?' }],
      tools,
      toolCtx,
      fetchImpl: stubFetch,
    })) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('chunk');
    expect(types[types.length - 1]).toBe('done');

    const toolCall = events.find((e) => e.type === 'tool_call');
    expect(toolCall).toMatchObject({
      type: 'tool_call',
      name: 'vector_search',
      args: { query: 'refund policy' },
    });

    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult).toMatchObject({ type: 'tool_result', name: 'vector_search' });

    const chunk = events.find((e) => e.type === 'chunk') as Extract<
      ChatStreamEvent,
      { type: 'chunk' }
    >;
    expect(chunk.text).toBe('Refunds are within 30 days.');

    expect(calls.filter((u) => u.includes('chat/completions')).length).toBe(2);
    expect(calls.filter((u) => u.includes('/api/v1/search')).length).toBe(1);
  });

  it('routes propose_action through the approvals queue and reports the proposal id', async () => {
    const { fetch: stubFetch } = fakeFetch([
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
                        id: 'call_xyz',
                        function: {
                          name: 'propose_action',
                          arguments:
                            '{"action_type":"send_email","payload":{"to":"a@b.com","body":"hi"},"reason":"user requested"}',
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
            { choices: [{ delta: { content: 'Proposed.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ]),
      },
    ]);

    const approvals = new ApprovalQueue({ store: new InMemoryApprovalStore() });
    const toolCtx: ToolContext = {
      approvals,
      vectorDbBaseUrl: 'http://vector.test',
      fetchImpl: stubFetch,
    };

    const events: ChatStreamEvent[] = [];
    for await (const event of runChatTurn({
      agent: baseAgent,
      messages: [{ role: 'user', content: 'Email Alice and tell her hi' }],
      tools,
      toolCtx,
      fetchImpl: stubFetch,
    })) {
      events.push(event);
    }

    const result = events.find((e) => e.type === 'tool_result') as Extract<
      ChatStreamEvent,
      { type: 'tool_result' }
    >;
    expect(result).toBeDefined();
    expect((result.result as { status: string }).status).toBe('pending');

    const pending = await approvals.list({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].action_type).toBe('send_email');
    expect(pending[0].payload).toEqual({ to: 'a@b.com', body: 'hi' });
    expect(pending[0].metadata).toEqual({ reason: 'user requested' });
  });

  it('emits tool_error for unknown tool names and continues the loop with the error fed back', async () => {
    const { fetch: stubFetch } = fakeFetch([
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
                        id: 'call_oops',
                        function: { name: 'does_not_exist', arguments: '{}' },
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
            { choices: [{ delta: { content: 'I cannot do that.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ]),
      },
    ]);

    const approvals = new ApprovalQueue({ store: new InMemoryApprovalStore() });
    const toolCtx: ToolContext = {
      approvals,
      vectorDbBaseUrl: 'http://vector.test',
      fetchImpl: stubFetch,
    };

    const events: ChatStreamEvent[] = [];
    for await (const event of runChatTurn({
      agent: baseAgent,
      messages: [{ role: 'user', content: 'Do a nonexistent thing' }],
      tools,
      toolCtx,
      fetchImpl: stubFetch,
    })) {
      events.push(event);
    }

    const errorEvent = events.find((e) => e.type === 'tool_error') as Extract<
      ChatStreamEvent,
      { type: 'tool_error' }
    >;
    expect(errorEvent).toBeDefined();
    expect(errorEvent.error).toContain('Unknown tool');
    expect(events[events.length - 1].type).toBe('done');
  });
});
