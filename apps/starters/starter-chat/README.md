# starter-chat

Minimal full-stack chatbot starter for OpenAI-compatible backends, with a built-in tool-use loop.

## What it shows

- Express backend that proxies to a configured OpenAI-compatible chat backend
- React client with streaming chat (SSE)
- **Tool-use loop**: when the model emits `tool_calls`, the backend dispatches them, feeds results back, and re-calls the model — no second runtime needed
- **Two demo tools** wired to Team Suzie pillars:
  - `vector_search` — calls `vector-db` (`:3006`)
  - `propose_action` — enqueues a proposal in the in-process approval queue (`@teamsuzie/approvals`)
- Approvals review endpoints at `GET /api/approvals` and `POST /api/approvals/:id/review`
- A clean base to extend into a more specific app

## Setup

```bash
cp apps/starters/starter-chat/.env.example apps/starters/starter-chat/.env
pnpm dev:starter-chat
```

Then open `http://localhost:17276`.

## Configuration

Set these in `.env`:

| Variable | Purpose |
|---|---|
| `STARTER_CHAT_AGENT_BASE_URL` | OpenAI-compatible base URL |
| `STARTER_CHAT_MODEL` | Model string sent to `/v1/chat/completions`. Use a model that supports tool use (e.g. `openai/gpt-4.1-mini`). |
| `STARTER_CHAT_AGENT_API_KEY` | Optional bearer token |
| `STARTER_CHAT_AGENT_NAME` | Label shown in the UI |
| `STARTER_CHAT_PORT` / `STARTER_CHAT_CLIENT_PORT` | Backend / frontend ports |
| `STARTER_CHAT_VECTOR_DB_BASE_URL` | Where `vector_search` should POST. Default `http://localhost:3006`. |
| `STARTER_CHAT_VECTOR_DB_API_KEY` | Optional `X-Agent-API-Key` for vector-db |
| `STARTER_CHAT_TOOL_MAX_ITERATIONS` | Cap on tool-use loop turns. Default `6`. |

## Tool use

The backend runs the standard OpenAI tool-use loop:

1. Forward chat to `${STARTER_CHAT_AGENT_BASE_URL}/v1/chat/completions` with `tools: [...]` describing the registered tools.
2. If the model returns `finish_reason: tool_calls`, dispatch each call against the registry, append `role: 'tool'` messages, and re-call.
3. Repeat until the model returns `finish_reason: stop` or the iteration cap is hit.

Tool steps are streamed to the client as new SSE events alongside text chunks:

```text
{ type: 'chunk', text }                     # incremental assistant text
{ type: 'tool_call', id, name, args }       # model decided to call a tool
{ type: 'tool_result', id, name, result }   # tool returned successfully
{ type: 'tool_error', id, name, error }     # tool threw
{ type: 'done' }
{ type: 'error', message }                  # fatal
```

The client renders each tool call as a collapsible card inside the assistant's message, so the user sees what the agent is doing during multi-step turns.

### Adding a tool

Drop a file in `src/tools/`, export a `ToolDefinition`, and add it to the array in `src/tools/index.ts`:

```ts
import type { ToolDefinition } from './types.js';

export const myTool: ToolDefinition<{ url: string }> = {
  name: 'fetch_url',
  description: 'Fetch a URL and return its text body.',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
    additionalProperties: false,
  },
  async execute(args) {
    const resp = await fetch(args.url);
    return { status: resp.status, body: (await resp.text()).slice(0, 4000) };
  },
};
```

Register dependencies your tool needs (queues, clients) in `ToolContext` and pass them in from `src/index.ts` at startup.

### Approvals

`propose_action` enqueues into an `InMemoryApprovalStore` owned by the running process — proposals don't survive restart. Suitable for a local demo. To wire a persistent store or a real dispatcher (email, Slack, webhook), implement `ApprovalStore` / `ApprovalDispatcher` from `@teamsuzie/approvals` and pass them to `new ApprovalQueue(...)` in `src/index.ts`.

The two review endpoints are intentionally minimal — list and review-by-id. Build your own UI on top, or point at the admin app.

## Tests

```bash
pnpm --filter @teamsuzie/starter-chat test
```

Covers the tool-use loop end-to-end with a stubbed model + vector-db, including the `propose_action` → approvals queue path and the unknown-tool error path.

## Why this app exists

The simplest generic starter template in the repo, with a real tool-use loop so "agent that calls services" works out of the box. Copy, rename, and adapt — the tool-use spine is yours to extend with whatever services your app needs (pptx-agent, xlsx-agent, your own APIs, etc.).
