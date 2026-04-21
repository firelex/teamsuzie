# admin

Operator control plane for the Team Suzie OSS stack. Agents, skills, approvals, text artifacts, bearer tokens, runtime config, and an audit-backed activity feed — plus the browser chat console that reaches the OpenClaw-compatible agents you've registered.

**Port 3008** (backend) / **5175** (Vite dev).

## Run

```bash
# From the repo root, bring up postgres + redis.
pnpm docker:up

# First time only.
cp apps/platform/admin/.env.example apps/platform/admin/.env

pnpm --filter @teamsuzie/admin dev
```

Open <http://localhost:5175> and sign in with the dev-mode demo credentials shown on the login page.

## Surface

| Page       | What it does                                                                              | Backend                                       |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Overview   | Live cards: recent activity, recently active agents, stack health, roadmap                | `/api/activity`, `/api/activity/recent-agents`|
| Chat       | OpenClaw-compatible chat console (DB-managed agents ∪ `CHAT_AGENTS` env entries)          | `WS /ws/chat/:id`, `/api/chat/agents`         |
| Agents     | CRUD for agents + seeded profile templates (Assistant, Researcher)                        | `/api/agents`, `/api/agent-profiles`          |
| Skills     | Discover `SKILL.md` manifests; attach per-agent                                           | `/api/skill-templates`                        |
| Approvals  | Inbox of human-in-the-loop proposals; approve/reject/dispatch; full audit trail           | `/api/approvals`                              |
| Artifacts  | Text files agents wrote to their workspace (markdown / json / yaml / text)                | `/api/workspace/files`                        |
| Tokens     | Agent API keys (multi-key, scope-tagged) and user bearer tokens                           | `/api/agent-keys`, `/api/auth/tokens`         |
| Config     | Scoped runtime settings (`agent → user → org → global → default`), encrypted at rest      | `/api/config`                                 |
| Activity   | Paginated audit-log feed with actor enrichment; filter by action / resource / actor       | `/api/activity`                               |

## Auth

Three lanes, all load-bearing somewhere in the app.

- **Session cookie** — browser UI. Login via `POST /api/auth/login`, logged-in probe at `GET /api/session`. All mutating UI calls use this lane.
- **User bearer token** (`tsu_…`) — laptop CLIs and mobile clients. Issued by `POST /api/auth/tokens`, sent as `Authorization: Bearer tsu_…`. Accepted everywhere a session cookie would be.
- **Agent bearer key** (`dtk_…`) — server-to-server, agent on its own credentials. Issued by `POST /api/agent-keys` with a scope list; sent as `Authorization: Bearer dtk_…`. Accepted on `POST /api/approvals` so agents can propose actions themselves; other operator routes stay session-only.

All creates + revokes write `AuditLog` rows (`api_key.create`, `api_key.revoke`). Agent delete cascades to the agent's API keys and workspace files.

## Chat agents

The Chat page pulls from two sources, unioned with a `source=db|env` marker on each row:

1. Agents created via `/api/agents` (stored in Postgres, status `active`)
2. `CHAT_AGENTS` in `apps/platform/admin/.env` — a JSON array, same shape as the registry:

   ```bash
   CHAT_AGENTS=[{"id":"suzie","name":"Suzie","baseUrl":"http://localhost:18789","apiKey":"your-token","openclawAgentId":"main"}]
   ```

Each message bumps `Agent.last_active_at` for DB agents so the Overview's "Recently active" card reflects real usage.

## Config

`ConfigDefinition` holds the schema; `ConfigValue` holds values. Resolution is `agent → user → org → global → definition default` (most-specific wins). Values are AES-256-GCM encrypted at rest with a secret derived from `CONFIG_SECRET` (falls back to `COOKIE_SECRET` in dev).

Sensitive definitions (`is_sensitive: true`) never return plaintext over HTTP — the UI renders `[REDACTED]` with "Replace" as the only action.

Seeded definitions:

| Key                              | Type    | Purpose                                                             |
| -------------------------------- | ------- | ------------------------------------------------------------------- |
| `admin.title`                    | string  | Overrides `ADMIN_TITLE` env in the sidebar wordmark + login card    |
| `chat.default_model`             | string  | Default model for OpenClaw completions. Read by `ChatProxyService`. |
| `approvals.require_by_default`   | boolean | Future default for new agents' `approval_required` flag             |
| `integrations.webhook_secret`    | secret  | Placeholder for inbound webhook signing (not consumed yet)          |

The UI edits the `global` scope only; per-agent / per-org overrides are fully supported at the API (`?scope=agent&scope_id=…`).

## Artifacts

Text only in this build. `AgentWorkspaceFile` stores one blob of `content` per `(organization_id, agent_id, file_path)`; `content_type` is one of `markdown | json | yaml | text`. `POST /api/workspace/files` upserts (201 on create, 200 on overwrite), rejects absolute paths and `..` traversal, and verifies the owning agent exists in the caller's org.

Binary outputs (pptx, xlsx, docx) need either a blob column on this table or a separate object-storage service — not in this build.

## Approvals

Backed by `@teamsuzie/approvals` with an `InMemoryApprovalStore`. A proposal is `POST /api/approvals` with `{action_type, payload, metadata?}`; a review is `POST /api/approvals/:id/review` with `{verdict: 'approve' | 'reject', reason?}`.

Approve auto-dispatches when a handler is registered for the item's `action_type`; otherwise the item stays in `approved` state for manual follow-up. The admin registers one generic `agent.action` dispatcher as a no-op fallback. Every propose + review writes an `AuditLog` row.

## Activity

The Activity page is a paginated view on `audit_log` with preset filter tabs (All / Agents / Approvals / Tokens / Config). Each row is enriched with the actor's email (user lane) or agent name (agent lane). Overview surfaces the latest 8 events plus the top 5 recently-active agents.

Token counts and tool-call timelines aren't captured here — that surface is owned by the llm-proxy's `usage_events` pipeline.

## Tests

Integration suite at `src/__tests__/` — one file per surface, supertest against the real Express app and a throwaway Postgres schema. **52 tests, ~3 seconds.**

```bash
pnpm docker:up                          # postgres + redis
pnpm --filter @teamsuzie/admin test     # or: pnpm -r test
```

`setup.ts` auto-creates the `teamsuzie_test` database on first run, drops & recreates the `public` schema on each invocation, and uses a process-scoped Redis key prefix so runs don't trample each other. Override `TEST_POSTGRES_BASE_URI` / `TEST_POSTGRES_DB` / `TEST_REDIS_URI` if your local infra differs.

## Stack

- Express + `@teamsuzie/shared-auth` on the backend (Sequelize + Redis + session, request-id middleware, actor attribution via `getRequestActor`)
- React + Vite + `@teamsuzie/ui` (Tailwind) on the client
- WebSocket transport for chat streaming
- `vitest` + `supertest` for the integration suite
