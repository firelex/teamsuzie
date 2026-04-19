import { useEffect, useMemo, useRef, useState } from 'react';

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

export default function App() {
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
    fetch('/api/chat/agents')
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
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Team Suzie OSS</p>
          <h1>Admin Chat</h1>
          <p className="lede">
            A thin browser chat for exercising OpenClaw-compatible agents against the OSS stack.
          </p>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Agents</h2>
            <span className={`status-pill status-${status}`}>{statusLabel(status)}</span>
          </div>

          {agents.length === 0 ? (
            <p className="muted">No agents configured yet.</p>
          ) : (
            <div className="agent-list">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className={`agent-button ${agent.id === selectedAgentId ? 'selected' : ''}`}
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <span className={`agent-dot ${agent.running ? 'running' : 'stopped'}`} />
                  <span>
                    <strong>{agent.name}</strong>
                    <small>{agent.description || (agent.running ? 'Reachable' : 'Not reachable')}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Setup</h2>
          <p className="muted">
            Add agents in <code>apps/platform/admin/.env</code> with <code>CHAT_AGENTS</code> and point each
            one at an OpenClaw-compatible <code>/v1/chat/completions</code> endpoint.
          </p>
        </div>
      </aside>

      <main className="chat-shell">
        <header className="chat-header">
          <div>
            <h2>{selectedAgent?.name || 'Select an agent'}</h2>
            <p className="muted">
              {selectedAgent
                ? selectedAgent.description || 'OpenClaw-compatible runtime'
                : 'Choose a configured agent to begin chatting.'}
            </p>
          </div>
          <button className="secondary-button" onClick={clearSession} disabled={!selectedAgentId}>
            Clear Session
          </button>
        </header>

        <section className="message-list">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Send a message to start a session.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-label">{message.role === 'user' ? 'You' : 'Agent'}</div>
                <div className="message-body">{message.content}</div>
              </article>
            ))
          )}
          <div ref={endRef} />
        </section>

        <footer className="composer">
          <textarea
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
          />
          <div className="composer-actions">
            <div className="muted">{error || 'Enter sends. Shift+Enter adds a new line.'}</div>
            <button className="primary-button" onClick={sendText} disabled={!input.trim() || !selectedAgentId}>
              Send
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
