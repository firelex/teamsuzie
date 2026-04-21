import type { Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { getRequestActor } from '@teamsuzie/shared-auth';
import { ChatProxyService, type ChatMessage } from '../services/chat-proxy.js';

interface ChatWebSocket extends WebSocket {
  agentId?: string;
  connectionId?: string;
  isAlive?: boolean;
}

interface IncomingChatMessage {
  type: 'text' | 'interrupt' | 'ping' | 'clear_session';
  text?: string;
}

interface OutgoingMessage {
  type: 'status' | 'transcript' | 'transcript_chunk' | 'error' | 'pong';
  status?: 'ready' | 'processing' | 'error';
  role?: 'user' | 'assistant';
  text?: string;
  message?: string;
}

export class ChatController {
  private readonly chatProxyService: ChatProxyService;
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(chatProxyService: ChatProxyService) {
    this.chatProxyService = chatProxyService;
  }

  initWebSocket(server: Server): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket: Socket, head) => {
      const url = request.url || '';
      const match = url.match(/^\/ws\/chat\/([A-Za-z0-9_-]+)/);
      if (!match) {
        return;
      }

      const agentId = match[1];

      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        const chatWs = ws as ChatWebSocket;
        chatWs.agentId = agentId;
        chatWs.connectionId = randomUUID();
        chatWs.isAlive = true;
        this.wss?.emit('connection', chatWs);
      });
    });

    this.wss.on('connection', (ws: ChatWebSocket) => {
      this.handleConnection(ws);
    });

    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((client) => {
        const chatWs = client as ChatWebSocket;
        if (!chatWs.isAlive) {
          client.terminate();
          return;
        }

        chatWs.isAlive = false;
        client.ping();
      });
    }, 30_000);
  }

  private handleConnection(ws: ChatWebSocket): void {
    const agentId = ws.agentId!;
    const connectionId = ws.connectionId!;
    const conversationHistory: ChatMessage[] = [];
    let currentAbortController: AbortController | null = null;

    this.sendWsMessage(ws, { type: 'status', status: 'ready' });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as IncomingChatMessage;
        switch (message.type) {
          case 'ping':
            this.sendWsMessage(ws, { type: 'pong' });
            break;
          case 'interrupt':
            currentAbortController?.abort();
            currentAbortController = null;
            this.sendWsMessage(ws, { type: 'status', status: 'ready' });
            break;
          case 'clear_session':
            this.chatProxyService.clearSession(connectionId);
            conversationHistory.length = 0;
            this.sendWsMessage(ws, { type: 'status', status: 'ready' });
            break;
          case 'text':
            if (!message.text?.trim()) {
              return;
            }
            conversationHistory.push({ role: 'user', content: message.text });
            this.sendWsMessage(ws, {
              type: 'transcript',
              role: 'user',
              text: message.text,
            });
            this.sendWsMessage(ws, { type: 'status', status: 'processing' });

            currentAbortController = new AbortController();
            let fullResponse = '';
            let firstChunk = true;

            try {
              for await (const chunk of this.chatProxyService.chatCompletionStream(
                agentId,
                conversationHistory,
                connectionId,
              )) {
                if (currentAbortController.signal.aborted) {
                  break;
                }

                fullResponse += chunk;
                if (firstChunk) {
                  this.sendWsMessage(ws, {
                    type: 'transcript',
                    role: 'assistant',
                    text: chunk,
                  });
                  firstChunk = false;
                } else {
                  this.sendWsMessage(ws, {
                    type: 'transcript_chunk',
                    text: chunk,
                  });
                }
              }

              if (!currentAbortController.signal.aborted) {
                conversationHistory.push({ role: 'assistant', content: fullResponse });
                this.sendWsMessage(ws, { type: 'status', status: 'ready' });
              }
            } catch (error) {
              this.sendWsMessage(ws, {
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to get response',
              });
              this.sendWsMessage(ws, { type: 'status', status: 'error' });
            } finally {
              currentAbortController = null;
            }
            break;
        }
      } catch (error) {
        this.sendWsMessage(ws, {
          type: 'error',
          message: error instanceof Error ? error.message : 'Invalid message',
        });
      }
    });

    ws.on('close', () => {
      this.chatProxyService.clearSession(connectionId);
      currentAbortController?.abort();
    });
  }

  private sendWsMessage(ws: WebSocket, message: OutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  listAgents = async (req: Request, res: Response): Promise<void> => {
    const actor = getRequestActor(req);
    try {
      const agents = await this.chatProxyService.listAgents();
      console.log(
        `[admin.chat.listAgents] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'} count=${agents.length}`,
      );
      res.json({ agents });
    } catch (error) {
      console.error(
        `[admin.chat.listAgents] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'} err=${error instanceof Error ? error.message : String(error)}`,
      );
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list agents',
      });
    }
  };
}
