# starter-chat

Minimal full-stack chatbot starter for OpenAI-compatible backends.

## What it shows

- One small Express backend that proxies to a configured chat backend
- One small React client with streaming chat
- A clean base to extend into a more specific app
- Works well with `llm-proxy`, OpenAI-compatible gateways, or your own chat service

## Setup

```bash
cp apps/starters/starter-chat/.env.example apps/starters/starter-chat/.env
pnpm dev:starter-chat
```

Then open `http://localhost:17276`.

## Configuration

Set these in `.env`:

- `STARTER_CHAT_AGENT_BASE_URL` — OpenAI-compatible base URL
- `STARTER_CHAT_MODEL` — model string to send to `/v1/chat/completions`
- `STARTER_CHAT_AGENT_API_KEY` — optional bearer token
- `STARTER_CHAT_AGENT_NAME` — label shown in the UI
- `STARTER_CHAT_PORT` — backend port for the starter server
- `STARTER_CHAT_CLIENT_PORT` — frontend Vite port for local dev

## Why this app exists

This is the simplest generic starter template in the repo. It is meant to be copied, renamed, and adapted into your own agentic application when you want a clean baseline without OpenClaw-specific assumptions.
