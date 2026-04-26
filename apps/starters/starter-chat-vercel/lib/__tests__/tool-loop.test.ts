import { describe, expect, it } from 'vitest';
import { ApprovalQueue, InMemoryApprovalStore } from '@teamsuzie/approvals';
import { runChatTurn, type ChatStreamEvent } from '../chat-provider';
import { tools } from '../tools/index';
import type { ToolContext } from '../tools/index';

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

describe('Vercel starter — tool-use loop', () => {
  it('runs vector_search through the loop end to end', async () => {
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
                        id: 'call_abc',
                        function: { name: 'vector_search', arguments: '{"query":"refund policy"}' },
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
        match: (url) => url === 'http://vector.test/api/v1/search',
        respond: () =>
          jsonResponse({
            success: true,
            data: [{ id: 'doc-1', score: 0.91, text: 'Refunds within 30 days.' }],
            query: 'refund policy',
          }),
      },
      {
        match: (url) => url === 'http://model.test/v1/chat/completions',
        respond: () =>
          sseResponse([
            { choices: [{ delta: { content: 'Refunds are within 30 days.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ]),
      },
    ]);

    const toolCtx: ToolContext = {
      approvals: new ApprovalQueue({ store: new InMemoryApprovalStore() }),
      vectorDbBaseUrl: 'http://vector.test',
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
      messages: [{ role: 'user', content: 'What is the refund policy?' }],
      tools,
      toolCtx,
      fetchImpl: stub,
    })) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('chunk');
    expect(types[types.length - 1]).toBe('done');
  });
});
