import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApprovalQueue, InMemoryApprovalStore } from '@teamsuzie/approvals';
import { config } from './config.js';
import { runChatTurn, type ChatMessage } from './chat-provider.js';
import { tools } from './tools/index.js';
import type { ToolContext } from './tools/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '../client/dist');

const approvals = new ApprovalQueue({ store: new InMemoryApprovalStore() });

const toolCtx: ToolContext = {
  approvals,
  vectorDbBaseUrl: config.vectorDb.baseUrl,
  vectorDbApiKey: config.vectorDb.apiKey,
};

const app = express();
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    let reachable = false;
    let runtimeError = '';

    try {
      await fetch(`${config.agent.baseUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      reachable = true;
    } catch (error) {
      runtimeError = error instanceof Error ? error.message : 'Health check failed';
    }

    if (!reachable) {
      try {
        const probe = await fetch(config.agent.baseUrl, {
          signal: AbortSignal.timeout(5_000),
        });
        reachable = probe.status > 0;
        runtimeError = '';
      } catch (error) {
        runtimeError = error instanceof Error ? error.message : runtimeError;
      }
    }

    res.json({
      status: 'ok',
      title: config.title,
      agent: {
        name: config.agent.name,
        description: config.agent.description,
        reachable,
      },
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    });
  } catch (error) {
    res.json({
      status: 'ok',
      title: config.title,
      agent: {
        name: config.agent.name,
        description: config.agent.description,
        reachable: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const history = Array.isArray(req.body?.history) ? (req.body.history as ChatMessage[]) : [];

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  const abort = new AbortController();
  req.on('close', () => abort.abort());

  const messages: ChatMessage[] = [...history, { role: 'user', content: message }];

  try {
    for await (const event of runChatTurn({
      agent: config.agent,
      messages,
      tools,
      toolCtx,
      maxIterations: config.tools.maxIterations,
      signal: abort.signal,
    })) {
      send(event);
      if (event.type === 'done' || event.type === 'error') break;
    }
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Chat request failed' });
  } finally {
    res.end();
  }
});

app.get('/api/approvals', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const items = await approvals.list({
    status: status === 'all' ? undefined : (status as 'pending' | 'approved' | 'rejected' | 'dispatched' | 'failed'),
  });
  res.json({ items });
});

app.post('/api/approvals/:id/review', async (req, res) => {
  const id = req.params.id;
  const verdict = req.body?.verdict === 'approve' ? 'approve' : 'reject';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

  try {
    const reviewed = await approvals.review(id, {
      reviewer_id: 'human',
      verdict,
      reason,
    });
    res.json({ ok: true, item: reviewed });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Review failed',
    });
  }
});

app.post('/api/session/reset', (req, res) => {
  res.json({ ok: true });
});

app.use(express.static(clientDistDir));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }

  res.sendFile(path.join(clientDistDir, 'index.html'), (error) => {
    if (error) {
      next();
    }
  });
});

app.listen(config.port, () => {
  console.log(`Starter chat listening on ${config.publicUrl}`);
});
