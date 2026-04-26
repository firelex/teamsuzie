import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalQueue, InMemoryApprovalStore } from '@teamsuzie/approvals';
import { runChatTurn, type ChatStreamEvent } from '../chat-provider.js';
import { loadSkills } from '../skills.js';
import { httpRequestTool, isHostAllowed } from '../tools/http-request.js';
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
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

describe('http_request allow-list', () => {
  it('matches hosts case-insensitively, exact match only', () => {
    expect(isHostAllowed('api.example.com', ['api.example.com'])).toBe(true);
    expect(isHostAllowed('API.Example.com', ['api.example.com'])).toBe(true);
    expect(isHostAllowed('api.example.com', ['other.example.com'])).toBe(false);
    expect(isHostAllowed('evil.example.com', ['api.example.com'])).toBe(false);
  });

  it('refuses when allow-list is empty', async () => {
    const ctx: ToolContext = {
      approvals: new ApprovalQueue({ store: new InMemoryApprovalStore() }),
      vectorDbBaseUrl: 'http://unused',
      allowedHttpHosts: [],
    };
    await expect(
      httpRequestTool.execute({ url: 'http://api.example.com/x' }, ctx),
    ).rejects.toThrow(/no hosts are on the allow-list/i);
  });

  it('refuses hosts not on the allow-list', async () => {
    const ctx: ToolContext = {
      approvals: new ApprovalQueue({ store: new InMemoryApprovalStore() }),
      vectorDbBaseUrl: 'http://unused',
      allowedHttpHosts: ['api.example.com'],
    };
    await expect(
      httpRequestTool.execute({ url: 'http://evil.example.com/x' }, ctx),
    ).rejects.toThrow(/not on the allow-list/i);
  });

  it('allows hosts on the list and returns status + body', async () => {
    const { fetch: stub } = fakeFetch([
      {
        match: (url) => url === 'http://api.example.com/ping',
        respond: () => jsonResponse({ ok: true }),
      },
    ]);
    const ctx: ToolContext = {
      approvals: new ApprovalQueue({ store: new InMemoryApprovalStore() }),
      vectorDbBaseUrl: 'http://unused',
      allowedHttpHosts: ['api.example.com'],
      fetchImpl: stub,
    };
    const result = (await httpRequestTool.execute(
      { url: 'http://api.example.com/ping' },
      ctx,
    )) as { status: number; body: string };
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ok: true });
  });
});

describe('skills loader', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-chat-skills-'));
    const skillDir = path.join(tmpDir, 'demo-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: Demo skill for tests.',
        '---',
        '# demo-skill',
        '',
        'Base URL: {{DEMO_AGENT_URL}}',
        'Auth: {{DEMO_API_KEY}}',
      ].join('\n'),
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads, renders, and concatenates skills into a system prompt', async () => {
    const result = await loadSkills({
      skillsDir: tmpDir,
      renderContext: {
        DEMO_AGENT_URL: 'http://demo.test',
        DEMO_API_KEY: 'sekret',
      },
    });

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].skillName).toBe('demo-skill');
    expect(result.skills[0].content).toContain('Base URL: http://demo.test');
    expect(result.skills[0].content).toContain('Auth: sekret');
    expect(result.systemPrompt).toContain('=== SKILL: demo-skill ===');
    expect(result.systemPrompt).toContain('http://demo.test');
  });

  it('derives http allow-list hosts from URL-shaped render-context values', async () => {
    const result = await loadSkills({
      skillsDir: tmpDir,
      renderContext: {
        DEMO_AGENT_URL: 'http://demo.test:9999',
        DEMO_API_KEY: 'not-a-url',
        OTHER_URL: 'https://other.test',
      },
    });

    expect(result.derivedHosts.sort()).toEqual(['demo.test:9999', 'other.test'].sort());
  });
});

describe('skills bridge end-to-end', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-chat-bridge-'));
    const skillDir = path.join(tmpDir, 'pinger');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: pinger',
        'description: Ping a service.',
        '---',
        '# pinger',
        '',
        'When the user asks for a ping, call:',
        '',
        'POST {{PINGER_URL}}/ping',
        'Authorization: Bearer {{PINGER_TOKEN}}',
      ].join('\n'),
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads a skill, the model emits an http_request to its URL, the bridge dispatches', async () => {
    const skillResult = await loadSkills({
      skillsDir: tmpDir,
      renderContext: {
        PINGER_URL: 'http://pinger.test',
        PINGER_TOKEN: 'abc',
      },
    });

    expect(skillResult.systemPrompt).toContain('POST http://pinger.test/ping');
    expect(skillResult.derivedHosts).toContain('pinger.test');

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
                        id: 'call_ping',
                        function: {
                          name: 'http_request',
                          arguments:
                            '{"url":"http://pinger.test/ping","method":"POST","headers":{"authorization":"Bearer abc"}}',
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
        match: (url) => url === 'http://pinger.test/ping',
        respond: () => jsonResponse({ pong: true }),
      },
      {
        match: (url) => url === 'http://model.test/v1/chat/completions',
        respond: () =>
          sseResponse([
            { choices: [{ delta: { content: 'Pinged successfully.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ]),
      },
    ]);

    const toolCtx: ToolContext = {
      approvals: new ApprovalQueue({ store: new InMemoryApprovalStore() }),
      vectorDbBaseUrl: 'http://vector.unused',
      allowedHttpHosts: skillResult.derivedHosts,
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
      messages: [{ role: 'user', content: 'ping' }],
      tools,
      toolCtx,
      systemPrompt: skillResult.systemPrompt,
      fetchImpl: stub,
    })) {
      events.push(event);
    }

    const toolCall = events.find((e) => e.type === 'tool_call');
    expect(toolCall).toMatchObject({ type: 'tool_call', name: 'http_request' });

    const toolResult = events.find((e) => e.type === 'tool_result') as Extract<
      ChatStreamEvent,
      { type: 'tool_result' }
    >;
    expect(toolResult).toBeDefined();
    expect((toolResult.result as { status: number }).status).toBe(200);

    expect(events[events.length - 1].type).toBe('done');
  });
});
