# starter-chat-openclaw

Minimal full-stack chatbot starter for OpenClaw-compatible agents.

## What it shows

- One small Express backend that proxies to a configured agent runtime
- One small React client with streaming chat
- Session continuity across messages
- A clean base to extend into a more specific app

## Setup

```bash
cp apps/starters/starter-chat-openclaw/.env.example apps/starters/starter-chat-openclaw/.env
pnpm dev:starter-chat-openclaw
```

Then open `http://localhost:15276`.

## Configuration

Set these in `.env`:

- `STARTER_CHAT_AGENT_BASE_URL` — OpenClaw-compatible base URL
- `STARTER_CHAT_AGENT_API_KEY` — optional bearer token
- `STARTER_CHAT_OPENCLAW_AGENT_ID` — optional OpenClaw agent id header
- `STARTER_CHAT_AGENT_NAME` — label shown in the UI
- `STARTER_CHAT_PORT` — backend port for the starter server
- `STARTER_CHAT_CLIENT_PORT` — frontend Vite port for local dev

## Why this app exists

This is the simplest OpenClaw-oriented starter template in the repo. It is meant to be copied, renamed, and adapted into your own agentic application when you want the Team Suzie + OpenClaw path.

If you want the generic baseline without OpenClaw-specific headers or model naming, use [apps/starters/starter-chat](../starter-chat/README.md).
