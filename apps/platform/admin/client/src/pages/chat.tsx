import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Button,
  PageHeader,
  PageHeaderActions,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
  Textarea,
} from '@teamsuzie/ui';

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'processing' | 'error';

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  running: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type IncomingMessage =
  | { type: 'status'; status: ConnectionStatus; message?: string }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string }
  | { type: 'transcript_chunk'; text: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connecting':
      return 'Connecting';
    case 'ready':
      return 'Ready';
    case 'processing':
      return 'Thinking';
    case 'error':
      return 'Error';
    default:
      return 'Disconnected';
  }
}

function statusVariant(status: ConnectionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'error':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function ChatPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    fetch('/api/chat/agents', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load agents: ${response.status}`);
        }
        return response.json() as Promise<{ agents: AgentInfo[] }>;
      })
      .then((data) => {
        setAgents(data.agents);
        const firstRunning = data.agents.find((agent) => agent.running);
        if (firstRunning) {
          setSelectedAgentId(firstRunning.id);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      });
  }, []);

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    wsRef.current?.close();
    setMessages([]);
    setStatus('connecting');
    setError('');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${selectedAgentId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('ready');
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data) as IncomingMessage;
      if (payload.type === 'status') {
        setStatus(payload.status);
        if (payload.message) {
          setError(payload.message);
        }
        return;
      }

      if (payload.type === 'transcript') {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: payload.role,
            content: payload.text,
          },
        ]);
        return;
      }

      if (payload.type === 'transcript_chunk') {
        setMessages((current) => {
          if (current.length === 0) {
            return current;
          }

          const next = [...current];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            content: last.content + payload.text,
          };
          return next;
        });
        return;
      }

      if (payload.type === 'error') {
        setStatus('error');
        setError(payload.message);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setError('WebSocket connection failed');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, [selectedAgentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendText() {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'text', text: input.trim() }));
    setInput('');
  }

  function clearSession() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear_session' }));
    }
    setMessages([]);
  }

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Chat</PageHeaderTitle>
          <PageHeaderDescription>
            Talk to any OpenClaw-compatible agent configured in <code className="font-mono text-xs">CHAT_AGENTS</code>.
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
          <Button variant="outline" size="sm" onClick={clearSession} disabled={!selectedAgentId}>
            Clear session
          </Button>
        </PageHeaderActions>
      </PageHeader>
      <AppShellContent>
        <div className="flex h-full min-h-0">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/40 md:flex">
            <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agents
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {agents.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No agents configured. Set <code className="font-mono">CHAT_AGENTS</code> in the admin <code className="font-mono">.env</code>.
                </p>
              ) : (
                <div className="space-y-1">
                  {agents.map((agent) => {
                    const selected = agent.id === selectedAgentId;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? 'border-primary/40 bg-background shadow-sm'
                            : 'border-transparent hover:bg-background/60'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-2 shrink-0 rounded-full ${
                            agent.running ? 'bg-primary' : 'bg-muted-foreground/40'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{agent.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {agent.description || (agent.running ? 'Reachable' : 'Not reachable')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedAgent ? (
                <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
                  Choose an agent from the left to start a session.
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
                  Send a message to start a session with <span className="font-medium text-foreground">{selectedAgent.name}</span>.
                </div>
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`rounded-lg border border-border p-3 text-sm ${
                        message.role === 'user' ? 'ml-auto max-w-[80%] bg-primary text-primary-foreground' : 'mr-auto max-w-[80%] bg-card'
                      }`}
                    >
                      <div className={`mb-1 text-[10px] uppercase tracking-wide ${message.role === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {message.role === 'user' ? 'You' : selectedAgent.name}
                      </div>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </article>
                  ))}
                  <div ref={endRef} />
                </div>
              )}
            </div>
            <div className="border-t border-border bg-card p-4">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendText();
                  }
                }}
                placeholder="Ask your agent to do something useful..."
                disabled={!selectedAgentId || status === 'processing'}
                className="min-h-24"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  {error || 'Enter sends. Shift+Enter adds a new line.'}
                </span>
                <Button onClick={sendText} disabled={!input.trim() || !selectedAgentId}>
                  Send
                </Button>
              </div>
            </div>
          </section>
        </div>
      </AppShellContent>
    </>
  );
}
