import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { readOpenClawTextStream, streamChatCompletion, type ChatMessage } from './openclaw.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '../client/dist');

const app = express();
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const sessions = new Map<string, string>();

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
        // Even a 404/405 from the runtime root means the endpoint is reachable.
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
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const message = String(req.body?.message || '').trim();
  const history = Array.isArray(req.body?.history) ? (req.body.history as ChatMessage[]) : [];

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const sessionKey = sessions.get(sessionId) || randomUUID();
  sessions.set(sessionId, sessionKey);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const messages: ChatMessage[] = [...history, { role: 'user', content: message }];
  let emittedText = false;

  try {
    const reader = await streamChatCompletion(config.agent, messages, sessionKey);
    for await (const chunk of readOpenClawTextStream(reader)) {
      emittedText = true;
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    }

    if (!emittedText) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message:
            'The agent runtime responded without any text. Check the runtime logs and model/provider connectivity.',
        })}\n\n`,
      );
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Chat request failed',
      })}\n\n`,
    );
  } finally {
    res.end();
  }
});

app.post('/api/session/reset', (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  if (sessionId) {
    sessions.delete(sessionId);
  }
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
