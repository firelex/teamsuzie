# Roadmap

Team Suzie OSS is an extraction from a working private codebase. The roadmap reflects what's already built and what's next.

## v0.1 — Runnable foundations *(current)*

The pillars ship as runnable, tested TypeScript packages, plus a full admin control plane on top. Ten workspace projects build clean; package-level unit tests and a 52-test admin integration suite run on `pnpm -r test`.

- [x] Repository structure and positioning docs
- [x] MIT license, contributing guide, security policy
- [x] Docker Compose for local infrastructure (Postgres, Redis, Milvus, Neo4j)
- [x] `packages/types` — shared scope and agent context types
- [x] `packages/shared-auth` — org/user/agent models, session auth, request-id middleware, upload-guard helpers, actor attribution (billing stripped)
- [x] `packages/skills` — headless skill runtime with filesystem delivery
- [x] `packages/approvals` — generic state machine with in-memory store
- [x] `packages/db-client` — typed clients for vector-db and graph-db
- [x] `packages/usage-tracker` — Redis-backed usage event publisher
- [x] `packages/config-client` — scoped config resolver (HTTP client for remote consumers)
- [x] `packages/ui` — shared React component library (AppShell, Sidebar, DataTable, Dialog, …)
- [x] `apps/platform/auth` — session-based auth service
- [x] `apps/platform/llm-proxy` — provider-agnostic LLM router with usage tracking
- [x] `apps/platform/vector-db` — Milvus REST wrapper with scope support
- [x] `apps/platform/graph-db` — Neo4j REST wrapper with scope support
- [x] `apps/platform/admin` — full control plane (see below)
- [x] `apps/starters/starter-chat` — generic OpenAI-compatible chat starter
- [x] `apps/starters/starter-chat-openclaw` — OpenClaw-oriented chat starter
- [x] `apps/starters/starter-ops-console` — internal-tool / ops-console starter with approval-gated destructive actions

### Admin control plane (shipped across Phases 0–7)

The admin app grew from "chat console" to a real control plane in seven phases. Each landed as a standalone commit with a README entry and is covered by the integration suite.

- [x] **Phase 0** — routed React shell, session auth, login/logout, Postgres + Redis bootstrap
- [x] **Phase 1** — agent registry (CRUD, profiles, DB-aware chat proxy)
- [x] **Phase 2** — skills browse + attach (manifest discovery, `{{TOKEN}}` → required-context extraction)
- [x] **Phase 3** — approvals inbox (propose/review/dispatch, auto-dispatch for registered action types, `AuditLog` writes)
- [x] **Phase 4** — text artifacts (upsert on `(agent_id, file_path)`, path-traversal guards, content-type enum)
- [x] **Phase 5** — tokens (multi-key per agent with scopes, user bearer tokens via shared-auth, cascade delete on agent removal)
- [x] **Phase 6** — config surface (scoped resolution: `agent → user → org → global → default`, AES-256-GCM at rest, sensitive redaction on HTTP)
- [x] **Phase 7** — activity & audit feed (paginated audit-log view, actor enrichment, recently-active agents)

## v0.2 — Polish + external integrations

- [ ] `apps/starters/starter-demo` — minimal example agent wired through the full stack
- [ ] `llm-proxy` → admin activity integration (token counts and tool-call timelines in `/api/activity`; currently admin surfaces `audit_log` + `Agent.last_active_at` only)
- [ ] `config-client` HTTP consumers exercised from at least one OSS service (admin reads config in-process today)
- [ ] CI: lint + typecheck + admin integration suite green on fresh clone
- [ ] Skill authoring guide expanded in `docs/EXTENSION_MODEL.md`

## v0.3 — First-party skills breadth

The headless skill runtime (`packages/skills`) and five shipped skill manifests (`file-access`, `hello-world`, `documents`, `presentations`, `spreadsheets`) landed in v0.1. v0.3 fills out the catalog.

- [ ] `inter-agent` skill (agent-to-agent messaging primitives)
- [ ] `token-usage` skill wired through the llm-proxy integration from v0.2
- [ ] DB-backed `SkillTarget` implementation in admin (upserts into `AgentWorkspaceFile`)
- [ ] Per-agent skill install / uninstall lifecycle in the UI (today the admin page lists + attaches; full apply/remove on the workspace side lands here)

## v0.4 — Approval queue, production-grade

The generic state machine, in-memory store, inbox UI, and `AuditLog` writes all shipped in v0.1 Phase 3. v0.4 makes the queue durable and ships reference dispatchers.

- [ ] Postgres / Sequelize `ApprovalStore` implementation (currently `InMemoryApprovalStore` — queue resets on admin restart)
- [ ] Email dispatcher reference (provider-agnostic; SendGrid / Resend / SMTP)
- [ ] Worker pattern docs (BullMQ or equivalent) for async dispatch outside the request cycle
- [ ] Bearer-authenticated external propose endpoint with rate limits

## v0.5 — Generalization and extensibility

- [ ] Binary artifact storage — either a blob column on `AgentWorkspaceFile` or an object-storage service (S3-compatible). v0.1 Phase 4 handles text only by design.
- [ ] Per-scope config editor in the admin UI (agent / user / org overrides — fully supported at the API today)
- [ ] Pluggable LLM provider adapters (third-party providers via plugins)
- [ ] Pluggable vector/graph backends (beyond Milvus / Neo4j)
- [ ] First external adapter contributions merged

## Explicitly not planned for OSS

These features exist upstream in the commercial [Team Suzie](https://teamsuzie.com) product and will stay there:

- Stripe billing, credits, subscriptions, BYOK management
- Paid-skill entitlements and enforcement
- Managed OAuth for Gmail / Outlook / Jira / etc. (OSS ships the interfaces; bring your own OAuth app)
- Kubernetes deployment manifests and hosted orchestration
- Customer-specific templates and integrations (Scissero, WSD, etc.)
- Premium document drafting (DOCX generation with styled templates)
- Voice agent (may be open-sourced separately later)

If you want those, use the hosted service. If you want to build your own variant, the seams are documented in [ARCHITECTURE.md](ARCHITECTURE.md).
