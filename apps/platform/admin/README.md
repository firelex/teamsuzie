# admin

Minimal OSS admin app with a browser chat console for OpenClaw-compatible agents. **Port 3008.**

## What it does today

- Lists chat-capable agents configured via `CHAT_AGENTS`
- Opens a browser chat session over WebSocket
- Streams assistant replies token-by-token
- Keeps per-connection session state so multi-turn conversations work

## Why this exists

The OSS repo should help people build working agentic applications quickly. This app is the thinnest useful control surface for that goal: point it at one or more OpenClaw-compatible agents and start chatting.

## What it does *not* do yet

- Org management
- Agent creation and API key issuance
- Config editing
- Skill installation UI
- Approval review UI
- Billing, managed OAuth, or deployment controls

Those broader admin surfaces are still on the roadmap. This first OSS slice focuses on the end-to-end chat path.

## Run

```bash
cp apps/platform/admin/.env.example apps/platform/admin/.env
pnpm dev:admin
```

Set `CHAT_AGENTS` in `.env` to a JSON array of agents. Each agent needs an `id`, `name`, and `baseUrl`, and can optionally include `apiKey` and `openclawAgentId`.

## Stack

- Express backend with a thin OpenClaw-compatible adapter
- React + Vite frontend in `client/`
- WebSocket transport for streaming chat
