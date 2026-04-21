# starter-ops-console

Internal-tool / ops-console starter. Polished admin surfaces (tables, auth guards, dialogs, CSV export) with Team Suzie's approval queue wired selectively to destructive actions.

Pick this starter when your app is mostly a tool with an agent attached, rather than mostly a chat. For chat-first apps, see [`starter-chat`](../starter-chat) or [`starter-chat-openclaw`](../starter-chat-openclaw).

## What it includes

- **App shell** (`AppShell`, `Sidebar`, `PageHeader`, `EmptyState` from `@teamsuzie/ui`)
- **Auth** via `@teamsuzie/shared-auth` (session cookies for the browser, optional bearer tokens for app clients; Postgres + Redis, multi-tenant, org-scoped)
- **Contacts CRUD** — full create / read / update / delete, scoped to your default organization
- **Approval-gated destructive actions** via `@teamsuzie/approvals`
- **Admin user list** — members of your default organization with role badges
- **Approvals inbox** — review / approve / reject pending actions
- **CSV export** — `/api/export/contacts.csv`
- **Seed script** — creates a demo admin user, demo org, and sample contacts

## Quick start

From the repo root, in order:

```bash
pnpm docker:up                                                               # postgres + redis (skips anything already on host ports)
cp apps/starters/starter-ops-console/.env.example apps/starters/starter-ops-console/.env
pnpm dev:starter-ops-console
```

Then open `http://localhost:18276`. In development the server auto-seeds a demo user (`demo@example.com` / `demo12345`) and an admin user (`admin@example.com` / `admin12345`) on first boot — the login page shows the demo credentials with a **Fill credentials** button. Manual reseed if you need it: `pnpm --filter @teamsuzie/starter-ops-console seed`.

### Troubleshooting

- **Port already in use** — `pnpm docker:up` checks each service's host port first and skips containers for ports that are already taken, assuming you want to keep the existing service. For redis this is fine; the starter works with any local redis. For postgres it can be a trap — see next item.
- **`role "teamsuzie" does not exist`** — postgres is running on `:5432` but it's not the one `docker:up` would have started, so it lacks the `teamsuzie` role and database. Fix it one of two ways: (a) stop your local postgres and re-run `pnpm docker:up` so docker provides one configured correctly — if you've had docker's postgres before and its volume is stale, first `docker compose -f docker/docker-compose.yml down -v` then `pnpm docker:up`; or (b) point the starter at your own postgres by editing `POSTGRES_URI` in `apps/starters/starter-ops-console/.env` and manually creating the target database.
- **Session issues** — clear the `starter-ops.sid` cookie and reload.

## Configuration

Key env vars (full list in `.env.example`):

- `STARTER_OPS_PORT` — backend port (default 18311)
- `STARTER_OPS_CLIENT_PORT` — frontend Vite port (default 18276)
- `STARTER_OPS_TITLE` — app title shown in the sidebar
- `STARTER_OPS_APPROVALS_ENABLED` — gate destructive actions through the approval queue (default `true`)
- `POSTGRES_URI`, `REDIS_URI` — connection strings (defaults match `pnpm docker:up`)
- `COOKIE_SECRET` — session signing key (change in production)
- `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME` — credentials created by the seed script

## Approval gating

On by default for clearly consequential actions only. Currently gated:

- `DELETE /api/contacts/:id` → proposed as `contact.delete`, dispatched by the registered dispatcher on approval

Create / edit / list / export are never gated — only actions with irreversible effects. Add more gated actions by registering new dispatchers in `src/services/approvals.ts` and checking `config.approvals.enabled` in the corresponding route.

Set `STARTER_OPS_APPROVALS_ENABLED=false` for local or simple use; destructive actions then run immediately without human review.

**Note:** The approval store in this starter is `InMemoryApprovalStore` — approvals vanish on process restart. Swap in a durable `ApprovalStore` for production (see `@teamsuzie/approvals` for the interface).

## Architecture

```
Browser (Vite :18276)
  └── /api proxy
        └── Express :18311
              ├── shared-auth session middleware (Redis)
              ├── /api/auth/*  ← createAuthRouter(sharedAuthConfig)
              ├── /api/session ← current user info
              ├── /api/contacts/*  ← CRUD; delete gated via @teamsuzie/approvals
              ├── /api/users  ← org members (read-only)
              ├── /api/approvals/* ← queue review / dispatch
              └── /api/export/contacts.csv
```

Contact records are org-scoped via `organization_id`. Each user has a `default_organization_id` from `shared-auth`; the starter reads that to filter queries.

## Extending

- **Add a gated action:** write a new `ApprovalDispatcher` in `src/services/approvals.ts`, then in your route call `queue.propose({ action_type: 'your.action', payload, ... })` when `config.approvals.enabled`.
- **Swap the approval store:** replace `InMemoryApprovalStore` in `createApprovalQueue()` with a durable implementation of `ApprovalStore`.
- **Add role-based admin features:** `requireAdmin` middleware in `src/middleware/auth.ts` checks `session.userRole === 'admin'`. Role changes and user deactivation are future phases; the `Users` page is read-only today.
- **Embed an agent:** the `agent.*` config fields are ready for an OpenAI-compatible backend — wire a chat drawer into `client/src/App.tsx` using the same pattern as `starter-chat`.
