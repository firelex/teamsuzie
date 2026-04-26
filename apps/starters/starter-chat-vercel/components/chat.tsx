'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Textarea, cn } from '@teamsuzie/ui';

interface HealthResponse {
  title: string;
  agent: { name: string; description?: string; reachable: boolean; error?: string };
  tools?: { name: string; description: string }[];
  skills?: { skillName: string; name: string; description: string; sourceId: string }[];
  mcp?: { name: string; connected: boolean; toolCount: number; error?: string }[];
  allowedHttpHosts?: string[];
}

interface ToolEvent {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  error?: string;
  status: 'running' | 'done' | 'error';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
}

const PROMPTS = [
  {
    title: 'Explain this starter',
    subtitle: 'How streaming + tools work end to end',
    prompt: 'Explain how this Next.js starter streams tool-use events from the API route to the UI.',
  },
  {
    title: 'List my installed skills',
    subtitle: 'What capabilities do I have right now?',
    prompt: 'List the skills I have installed and what each one does.',
  },
  {
    title: 'List my MCP servers',
    subtitle: 'Which external tool servers am I connected to?',
    prompt: 'List the MCP servers I am connected to and the tools each exposes.',
  },
  {
    title: 'What can you not do here?',
    subtitle: 'Honest limits of the Vercel deployment',
    prompt:
      'Given that I am running you on Vercel serverless, what limitations should I know about (state, transports, timeouts)?',
  },
];

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatusDot({ name, state }: { name: string; state: 'online' | 'offline' | 'pending' }) {
  const dot = {
    online: 'bg-emerald-500',
    offline: 'bg-destructive',
    pending: 'bg-muted-foreground/50',
  }[state];
  const title = {
    online: 'Runtime reachable',
    offline: 'Runtime offline',
    pending: 'Checking runtime',
  }[state];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" title={title}>
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
      <span className="font-medium text-foreground/80">{name}</span>
    </span>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" role="status" aria-label="Assistant is typing">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

function ToolCallCard({ event }: { event: ToolEvent }) {
  const [open, setOpen] = useState(false);
  const statusLabel = { running: 'Running…', done: 'Completed', error: 'Failed' }[event.status];
  const statusColor = {
    running: 'text-muted-foreground',
    done: 'text-emerald-600 dark:text-emerald-500',
    error: 'text-destructive',
  }[event.status];

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 font-mono text-foreground">
          <span aria-hidden="true">⚙︎</span>
          <span className="font-medium">{event.name}</span>
        </span>
        <span className={cn('text-xs font-medium', statusColor)}>{statusLabel}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-border pt-2 text-xs">
          {event.args !== undefined && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Arguments</div>
              <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">
                {JSON.stringify(event.args, null, 2)}
              </pre>
            </div>
          )}
          {event.result !== undefined && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Result</div>
              <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">
                {JSON.stringify(event.result, null, 2)}
              </pre>
            </div>
          )}
          {event.error && (
            <div className="text-destructive">
              <div className="mb-1 text-[11px] uppercase tracking-wider">Error</div>
              <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">{event.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageItem({
  message,
  agentName,
  isStreaming,
}: {
  message: Message;
  agentName: string;
  isStreaming: boolean;
}) {
  const isUser = message.role === 'user';
  const hasToolEvents = !!message.toolEvents && message.toolEvents.length > 0;
  const showTyping = !isUser && isStreaming && message.content.length === 0 && !hasToolEvents;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-foreground px-4 py-2.5 text-[15px] leading-relaxed text-background">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-medium text-muted-foreground">{agentName}</div>
      {hasToolEvents && (
        <div>
          {message.toolEvents!.map((event) => (
            <ToolCallCard key={event.id} event={event} />
          ))}
        </div>
      )}
      {showTyping ? (
        <div className="text-[15px] leading-relaxed">
          <TypingDots />
        </div>
      ) : (
        message.content.length > 0 && <MarkdownMessage content={message.content} />
      )}
    </div>
  );
}

export function Chat({ title, agentName: defaultName }: { title: string; agentName: string }) {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoaded, setHealthLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const agentName = health?.agent?.name || defaultName;
  const agentReachable = health?.agent?.reachable ?? false;
  const statusState: 'online' | 'offline' | 'pending' = !healthLoaded
    ? 'pending'
    : agentReachable
      ? 'online'
      : 'offline';

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load health'))
      .finally(() => setHealthLoaded(true));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || status === 'sending') return;

    const nextUserMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const nextHistory = [...messages, nextUserMessage].map(({ role, content }) => ({ role, content }));
    const assistantId = crypto.randomUUID();

    setMessages((cur) => [...cur, nextUserMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setStatus('sending');
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, history: nextHistory.slice(0, -1) }),
      });
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const line = evt.split('\n').find((c) => c.startsWith('data: '));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as
            | { type: 'chunk'; text: string }
            | { type: 'tool_call'; id: string; name: string; args: unknown }
            | { type: 'tool_result'; id: string; name: string; result: unknown }
            | { type: 'tool_error'; id: string; name: string; error: string }
            | { type: 'done' }
            | { type: 'error'; message: string };

          if (payload.type === 'chunk') {
            setMessages((cur) =>
              cur.map((m) => (m.id === assistantId ? { ...m, content: m.content + payload.text } : m)),
            );
          } else if (payload.type === 'tool_call') {
            setMessages((cur) =>
              cur.map((m) => {
                if (m.id !== assistantId) return m;
                const events = m.toolEvents ?? [];
                return {
                  ...m,
                  toolEvents: [
                    ...events,
                    { id: payload.id, name: payload.name, args: payload.args, status: 'running' as const },
                  ],
                };
              }),
            );
          } else if (payload.type === 'tool_result') {
            setMessages((cur) =>
              cur.map((m) => {
                if (m.id !== assistantId) return m;
                const events = (m.toolEvents ?? []).map((e) =>
                  e.id === payload.id ? { ...e, result: payload.result, status: 'done' as const } : e,
                );
                return { ...m, toolEvents: events };
              }),
            );
          } else if (payload.type === 'tool_error') {
            setMessages((cur) =>
              cur.map((m) => {
                if (m.id !== assistantId) return m;
                const events = (m.toolEvents ?? []).map((e) =>
                  e.id === payload.id ? { ...e, error: payload.error, status: 'error' as const } : e,
                );
                return { ...m, toolEvents: events };
              }),
            );
          } else if (payload.type === 'error') {
            setError(payload.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setStatus('idle');
    }
  }

  const isStreaming = status === 'sending';
  const isEmpty = messages.length === 0;
  const salutation = useMemo(() => greetingFor(new Date()), []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="text-sm font-medium">{health?.title || title}</div>
        <StatusDot name={agentName} state={statusState} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-6 py-16">
            <h1 className="text-3xl font-semibold tracking-tight">{salutation}</h1>
            <p className="mt-2 text-sm text-muted-foreground">How can {agentName} help today?</p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {PROMPTS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => void sendMessage(card.prompt)}
                  className="rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-accent"
                >
                  <div className="text-sm font-medium">{card.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{card.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} agentName={agentName} isStreaming={isStreaming} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background px-5 py-4">
        <div className="mx-auto w-full max-w-3xl">
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="rounded-2xl border border-border bg-card shadow-sm transition-all focus-within:border-foreground/25 focus-within:shadow-md">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={`Message ${agentName}`}
              disabled={isStreaming}
              className="min-h-16 resize-none border-0 bg-transparent px-4 pt-3 text-[15px] shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <p className="text-xs text-muted-foreground">Enter sends. Shift + Enter adds a line.</p>
              <Button
                size="sm"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isStreaming}
                className="h-8 rounded-full px-4"
              >
                {isStreaming ? <TypingDots /> : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
