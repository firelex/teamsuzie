# AGENTS.md

This repo is meant to be worked on by coding agents. Read this file before
editing. Then read any nested `AGENTS.md` in the area you touch.

## Project Shape

Team Suzie OSS is the open business operating layer for agent systems:

- multi-tenant auth and scoped state
- headless skill discovery, rendering, and workspace delivery
- approval queues
- LLM proxying and usage tracking
- admin/operator UI
- example apps that prove extension contracts

Commercial hosted features are intentionally outside this repo. Do not add
billing, Stripe, paid-skill entitlement enforcement, managed OAuth credentials,
hosted orchestration, or customer/private integrations to OSS code.

Read:

- `docs/ARCHITECTURE.md`
- `docs/EXTENSION_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/AGENT_OSS_BOUNDARY.md`
- `docs/AGENT_SECURITY.md`

## Working Rules

- Prefer small, focused changes that preserve existing package boundaries.
- Match local patterns before introducing new abstractions.
- Keep reusable packages free of hosted/staging/customer assumptions.
- Do not add private registries, private GitHub dependencies, customer SDKs, or
  hardcoded production URLs.
- Do not commit secrets, generated customer artifacts, private prompts, or real
  customer examples.
- If a change touches auth, tenant scoping, skills, approvals, config, file
  writes, or external network calls, treat it as security-sensitive.
- Add tests for behavioral changes. Favor focused unit tests unless the behavior
  crosses an app boundary.

## Reuse Over Duplication

This repo is the **upstream** for downstream forks (apps built on Team Suzie in
sibling repos). The whole point of the `packages/*` workspaces is that
downstream consumes them — so anything reusable belongs there, **not** copy-pasted
into each starter or fork.

**The rule of thumb.** If a component, hook, helper, or schema is plausibly
useful in more than one app — even if only one consumer exists today — it
belongs in an upstream package (`packages/ui`, `packages/agent-loop`,
`packages/markdown-document`, `packages/db-sqlite`, etc.) so apps import it.

**Smells that mean "extract first":**
- "Now do the same change downstream" — if the same diff lands twice, the
  abstraction is missing.
- Two starter apps with near-identical files (e.g. inline `MarkdownMessage`,
  `ToolUseStatus`, status indicators) — extract once, both import.
- Inline definitions of types or schemas that another app would need to
  re-derive — define once and re-export.

**Sample apps under `apps/starters/*` are consumers too.** They are showcases
of how to use the platform packages — not the source of truth for chat-shell
patterns, UI primitives, or tool-use rendering. When evolving `starter-chat`,
ask whether the change belongs in `@teamsuzie/ui` (or `@teamsuzie/agent-loop`,
etc.) so the downstream apps that import the starter's patterns get it for
free.

**App-specific stays per-app.** What's *not* extractable: route compositions,
auth-specific glue (e.g. `Protected`, `useSession`), per-app brand strings, the
list of seeded prompts/workflows for a particular vertical. Don't push these
into shared packages.

## OSS vs Hosted Boundary

This is the most important product boundary in the repo:

- OSS may expose interfaces, adapters, metadata, and hooks.
- Hosted/private code may implement billing, entitlements, paid catalogs,
  managed credentials, and deployment automation.

For paid skills specifically:

- OSS can represent `access: "paid"` as catalog metadata.
- OSS can call a `SkillInstallPolicy`.
- OSS must not include commercial entitlement state or payment enforcement.
- Remote skill catalogs should return raw templates; render agent context locally.

## Common Commands

Run focused checks for the package or app you changed:

```bash
pnpm --filter @teamsuzie/skills test
pnpm --filter @teamsuzie/skills typecheck
pnpm --filter @teamsuzie/admin typecheck
pnpm --filter @teamsuzie/admin-client build
pnpm --filter @teamsuzie/skill-catalog-host typecheck
pnpm --filter @teamsuzie/skill-catalog-host build
```

Some admin integration tests need local Postgres/Redis. If a sandbox blocks
localhost access, report that clearly and rerun with the appropriate approval.

## File Ownership Hints

- `packages/skills`: headless skill runtime and source contracts.
- `apps/platform/admin`: operator API and UI.
- `apps/examples`: small reference services proving extension contracts.
- `docs`: architecture, extension, security, quickstart, and agent guidance.

When in doubt, document the boundary instead of smuggling hosted assumptions into
the reusable core.
