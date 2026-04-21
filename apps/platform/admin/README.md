# admin

OSS admin control plane for the Team Suzie stack. **Port 3008** (backend) / **5175** (Vite dev).

This is the thicker successor to the original "chat-only" admin. It ships phase-by-phase — Phase 0 (this one) wires the foundations that every subsequent phase plugs into.

## Phase 0 — what's live

- Routed React shell: Overview, Chat, and placeholder pages for Agents / Skills / Approvals / Artifacts / Tokens / Config / Activity
- Session-based auth via `@teamsuzie/shared-auth` (login, logout, `/api/session`)
- Postgres + Redis backed by `SequelizeService` + `SessionService`
- Dev-only seed: admin + demo users shown on the login page
- The original OpenClaw chat proxy (HTTP + WebSocket streaming) now lives under the **Chat** tab

## What's coming

| Phase | Surface   | Summary                                                                     |
| ----- | --------- | --------------------------------------------------------------------------- |
| 1     | Agents    | CRUD, runtime type (direct / openclaw), model, system prompt, skills, approval policy |
| 2     | Skills    | Browse skill manifests; attach skills to agents                             |
| 3     | Approvals | Inbox of agent-proposed actions with approve/reject + audit                 |
| 4     | Artifacts | Browser for files produced by agents (pptx/xlsx/docx/uploads)               |
| 5     | Tokens    | Agent API keys + user bearer tokens                                         |
| 6     | Config    | Runtime-editable scoped settings (system / org / user / agent)              |
| 7     | Activity  | Recent sessions, tool calls, token usage                                    |

## Run (local)

```bash
# From the repo root, bring up postgres + redis.
pnpm docker:up

# First time only.
cp apps/platform/admin/.env.example apps/platform/admin/.env

pnpm --filter @teamsuzie/admin dev
```

Then open <http://localhost:5175> and sign in with the demo credentials shown on the login page.

## Configuring chat agents

The Chat page reads from `CHAT_AGENTS` in `apps/platform/admin/.env`. Each agent needs `id`, `name`, and `baseUrl`; optional `apiKey` and `openclawAgentId`:

```bash
CHAT_AGENTS=[{"id":"suzie","name":"Suzie","baseUrl":"http://localhost:18789","apiKey":"your-token","openclawAgentId":"main"}]
```

Once Phase 1 lands, DB-managed agents will take precedence over this env fallback.

## Stack

- Express + `@teamsuzie/shared-auth` on the backend (Sequelize + Redis + session)
- React + Vite + `@teamsuzie/ui` (Tailwind) on the client
- WebSocket transport for chat streaming
