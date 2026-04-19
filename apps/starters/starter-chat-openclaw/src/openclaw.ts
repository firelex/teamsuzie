export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamChunk {
  choices: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

export interface AgentTarget {
  baseUrl: string;
  apiKey?: string;
  openclawAgentId?: string;
}

function getOpenClawModel(agent: AgentTarget): string {
  if (agent.openclawAgentId) {
    return `openclaw/${agent.openclawAgentId}`;
  }

  return 'openclaw';
}

export async function streamChatCompletion(
  agent: AgentTarget,
  messages: ChatMessage[],
  sessionKey: string,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-openclaw-session-key': sessionKey,
  };

  if (agent.apiKey) {
    headers.Authorization = `Bearer ${agent.apiKey}`;
  }
  if (agent.openclawAgentId) {
    headers['x-openclaw-agent-id'] = agent.openclawAgentId;
  }

  const response = await fetch(`${agent.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: getOpenClawModel(agent),
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Agent returned ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!response.body) {
    throw new Error('Agent returned no response body');
  }

  return response.body.getReader();
}

export async function* readOpenClawTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue;
        }

        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') {
          continue;
        }

        try {
          const chunk = JSON.parse(data) as StreamChunk;
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Ignore malformed chunks from the runtime.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
