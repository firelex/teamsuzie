import { NextRequest } from 'next/server';
import { runChatTurn, type ChatMessage } from '@teamsuzie/agent-loop';
import { config } from '@/lib/config';
import { ensureBoot, getActiveTools, getSkillsState, getToolContext } from '@/lib/runtime';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await ensureBoot();

  let body: { message?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = String(body.message ?? '').trim();
  const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];

  if (!message) {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }

  const messages: ChatMessage[] = [...history, { role: 'user', content: message }];
  const skillsState = getSkillsState();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        for await (const event of runChatTurn({
          agent: config.agent,
          messages,
          tools: getActiveTools(),
          toolCtx: getToolContext(),
          systemPrompt: skillsState.systemPrompt || undefined,
          maxIterations: config.tools.maxIterations,
          signal: req.signal,
        })) {
          send(event);
          if (event.type === 'done' || event.type === 'error') break;
        }
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Chat request failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
