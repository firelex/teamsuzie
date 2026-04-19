import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from '@teamsuzie/ui';

interface HealthResponse {
  title: string;
  agent: {
    name: string;
    description?: string;
    reachable: boolean;
    error?: string;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const agentName = health?.agent?.name || 'Assistant';
  const agentDescription = health?.agent?.description || 'OpenAI-compatible assistant';
  const agentReachable = health?.agent?.reachable ?? false;
  const agentStatusText = agentReachable
    ? 'The runtime answered the health check and is ready for chat.'
    : health?.agent?.error || 'The runtime health check failed.';

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load health');
      });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || status === 'sending') {
      return;
    }

    const nextUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    const nextHistory = [...messages, nextUserMessage].map(({ role, content }) => ({ role, content }));
    const assistantId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      nextUserMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setInput('');
    setStatus('sending');
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          history: nextHistory.slice(0, -1),
        }),
      });

      if (!response.body) {
        throw new Error('No response body from starter chat backend');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const line = event
            .split('\n')
            .find((candidate) => candidate.startsWith('data: '));

          if (!line) {
            continue;
          }

          const payload = JSON.parse(line.slice(6)) as
            | { type: 'chunk'; text: string }
            | { type: 'done' }
            | { type: 'error'; message: string };

          if (payload.type === 'chunk') {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + payload.text }
                  : message,
              ),
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

  async function resetSession() {
    await fetch('/api/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => undefined);

    setMessages([]);
    setError('');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(31,111,95,0.16),transparent_24%),linear-gradient(180deg,#f3f6f0_0%,#e2eadf_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-4 border-b border-border/70 pb-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Starter Template</p>
            <div className="space-y-2">
              <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{health?.title || 'Starter Chat'}</h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                A minimal chatbot starter you can copy into your own agentic application, now using the same React, Tailwind, and UI component approach as the rest of the repo.
              </p>
            </div>
          </div>

          <Card className="border-emerald-900/10 bg-white/75 backdrop-blur">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{agentName}</CardTitle>
                  <CardDescription>{agentDescription}</CardDescription>
                </div>
                <Badge variant={agentReachable ? 'default' : 'destructive'}>
                  {agentReachable ? 'Reachable' : 'Offline'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{agentStatusText}</p>
            </CardContent>
          </Card>
        </header>

        <main className="grid min-h-0 flex-1 gap-6 py-6 lg:grid-cols-[1.6fr_0.7fr]">
          <Card className="flex min-h-[60vh] flex-col overflow-hidden border-emerald-900/10 bg-white/70 backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Conversation</CardTitle>
                  <CardDescription>
                    A small chat shell over any OpenAI-compatible backend.
                  </CardDescription>
                </div>
                <Badge variant={status === 'sending' ? 'secondary' : 'outline'}>
                  {status === 'sending' ? 'Streaming' : 'Idle'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <section className="flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
                <div className="grid min-h-full place-items-center text-center text-muted-foreground">
                  <div className="max-w-md space-y-2">
                    <p className="text-lg font-medium text-foreground">Start the conversation</p>
                    <p>
                      Send a message to begin. This starter is meant to be the cleanest possible base for agentic apps that just need a chat surface and a backend adapter.
                    </p>
                  </div>
            </div>
          ) : (
            messages.map((message) => (
                    <article
                      key={message.id}
                      className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                          className={`max-w-3xl rounded-2xl border px-4 py-3 shadow-sm ${
                            message.role === 'user'
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-border bg-background/90 text-foreground'
                          }`}
                        >
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">
                            {message.role === 'user' ? 'You' : agentName}
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-6">
                            {message.content || (message.role === 'assistant' && status === 'sending' ? '...' : '')}
                          </div>
                        </div>
              </article>
            ))
          )}
          <div ref={endRef} />
        </section>

              <footer className="border-t border-border/70 p-5">
                <div className="space-y-3">
                  <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Ask the assistant to help with a task..."
            disabled={status === 'sending'}
                    className="min-h-32 resize-y rounded-2xl bg-white/90"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {error || 'Enter sends. Shift+Enter adds a line break.'}
                    </p>
                    <div className="flex gap-2 self-end">
                      <Button variant="outline" onClick={() => void resetSession()}>
                        Reset Session
                      </Button>
                      <Button onClick={() => void sendMessage()} disabled={!input.trim() || status === 'sending'}>
                {status === 'sending' ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              </footer>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-emerald-900/10 bg-white/75 backdrop-blur">
              <CardHeader>
                <CardTitle>Why This Starter</CardTitle>
                <CardDescription>Designed to be copied and specialized.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Use this starter when you want a clean browser chat with one configured runtime and minimal ceremony.</p>
                <p>The next logical specialization is a document assistant that routes requests to `pptx-agent` and `xlsx-agent`.</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-900/10 bg-white/75 backdrop-blur">
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>Ways to evolve this into an app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Add tool-aware prompts and agent roles.</p>
                <p>2. Persist chat history by org, user, or agent.</p>
                <p>3. Route deck requests to `pptx-agent` and spreadsheet requests to `xlsx-agent`.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
