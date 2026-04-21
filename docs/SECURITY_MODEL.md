# Security model

This document describes the security posture of Team Suzie OSS as of v0.1. It
is not a list of features — it is a map from each attack surface to the
mechanism that defends it and the call site that applies it. Treat it as the
authoritative answer when you're unsure which auth lane a new endpoint should
use.

## The three auth lanes

Every request that reaches an OSS service lands in exactly one of three lanes.
Pick the lane by asking *who holds the credential* — the end user (in a
browser), an end user (in a CLI), or a service/agent process.

### 1. Browser session (cookie + CSRF)

- **Credential:** `HttpOnly`, `Secure`, `SameSite` session cookie minted by
  `SessionService.issue()`.
- **Where:** any route a browser calls on `apps/platform/auth`,
  `apps/platform/admin`, `apps/starters/starter-ops-console`.
- **How:** `SessionService` stores the session server-side (Redis); the client
  only sees an opaque cookie id. State-changing methods (POST/PUT/PATCH/DELETE)
  are additionally gated by `CsrfMiddleware`, which issues a token on every
  response and requires a matching `X-CSRF-Token` header on write requests.
- **Why this lane:** defends against another origin forging a request the user
  didn't initiate (CSRF / session-riding).

**Rule:** If you add a route that a browser will call, use this lane. Do not
reach for bearer-token auth as a shortcut — you will lose CSRF protection and
you will have a cookie-or-token ambiguity the first time someone points a
browser at your route.

### 2. User bearer token

- **Credential:** `UserAccessToken` row, issued by `POST /api/auth/tokens`
  while the user is authenticated with a session.
- **Where:** CLI tools, mobile apps, first-party scripts.
- **How:** `Authorization: Bearer <token>`. `AuthController.getAuthenticatedUser`
  recognises it as the bearer lane and resolves the user via
  `UserService.authenticateAccessToken`.
- **Why this lane:** user-initiated but not browser-originated. The client
  already has secure storage for secrets (keychain, env var), so we don't need
  cookies or CSRF. The token carries the user's identity forward.

**Rule:** Any non-browser client that acts *as a specific user* belongs in this
lane. The token is revocable per-row (`DELETE /api/auth/tokens/:id`); do not
add flows that require the user to paste their password into a non-browser
context.

### 3. Agent / service bearer token

Sub-lanes with the same shape — all three are "the caller is a process, not a
person":

- **Agent bearer (`dtk_*` API keys)** — `AgentAuthMiddleware` in
  `packages/shared-auth/src/middleware/agent-auth.ts`. Identifies an `Agent`
  row, and transitively the `Organization` the agent belongs to.
- **Service bearer (`INTERNAL_SERVICE_KEY`)** — `createServiceAuth` in
  `packages/shared-auth/src/middleware/service-auth.ts`. Identifies a
  *calling service*, not a user — the route behind it must not act on a
  specific user's behalf without other identity signals.
- **LLM proxy bearer** — `authMiddleware` in
  `apps/platform/llm-proxy/src/middleware/auth.ts`. Requires a Bearer token on
  every call; the SHA-256 of the token is used as the agent attribution key in
  usage events.

**Rule:** Bearer-lane routes are NOT CSRF-protected. If you find yourself
wanting to call one of them from a browser on behalf of a logged-in user, stop:
that traffic belongs on the session lane, routed through a service that calls
the bearer endpoint itself.

## Which lane does my new endpoint belong in?

```
caller is a browser?          → session + CSRF
caller is a human-run CLI?    → user bearer
caller is an agent process?   → agent bearer (scoped to an org)
caller is another service?    → service bearer
```

If the answer is "more than one of the above," split the endpoint. A single
handler that tries to accept both session and bearer auth ends up with
inconsistent CSRF behaviour and confused attribution.

## Request attribution

Every request is tagged end-to-end so that *who did what, when, under which
request* is answerable from logs alone.

- **Request id** — `createRequestId()` middleware
  (`packages/shared-auth/src/middleware/request-id.ts`, plus a local copy in
  `apps/platform/llm-proxy/src/middleware/request-id.ts` so the proxy doesn't
  pull in shared-auth). Mounts near the top of the middleware stack. Accepts
  an incoming `X-Request-Id` if it matches `/^[A-Za-z0-9_.:-]{6,128}$/` —
  otherwise mints a UUID v4. Always echoes the final id back as the response
  header `X-Request-Id`.
- **Actor** — `getRequestActor(req)` (`packages/shared-auth/src/utils/actor.ts`)
  normalises `session` / `agent` / `service` / `anonymous` into a single
  `{type, userId, agentId, orgId, requestId}` shape. Use it at the top of an
  action handler and pass the result to structured log lines or audit rows.
- **Org** — resolved by the auth lane itself (session ⇒ `session.organizationId`,
  agent ⇒ `agentContext.org_id`). Never trust an org id passed in the request
  body — always read it from the authenticated context.

**Rule:** When you add a new control-plane action (admin operation, approval
dispatch, config write), log `{requestId, actorType, userId, agentId, orgId,
action, resource}` at minimum. A raw "admin did X" log with no request id
cannot be correlated with the upstream request that triggered it.

## Request-id propagation

When one OSS service calls another, forward the id:

```ts
const res = await fetch(`${otherService}/api/foo`, {
    headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': req.requestId!,
        // plus the appropriate auth header for the target's lane
    },
    body: ...,
});
```

The receiving middleware will pick it up and reuse it, so a single id walks
through the whole call tree. We do *not* forward the request id to external
LLM providers — they have their own (e.g. OpenAI's `openai-request-id`
response header, which the proxy already logs alongside ours).

## Uploads

Team Suzie OSS does not ship with file-upload routes today. When a service
adds one, use the helpers in `packages/shared-auth/src/utils/upload-guard.ts`
rather than open-coding per-route limits. See [UPLOADS.md](UPLOADS.md) for
the concrete defaults and example wiring.

## Secrets

- `COOKIE_SECRET` — signs session cookies. Rotating invalidates every session.
  Required in production; a dev default exists so `pnpm dev` boots without
  config.
- `CONFIG_ENCRYPTION_KEY` — encrypts config values written through the admin.
- `INTERNAL_SERVICE_KEY` — shared across the control plane so services can
  authenticate calls to each other. Treat it as a tier-0 secret; anyone with
  this key can invoke any internal-only endpoint.
- Provider LLM keys — live in the process environment, hot-reloadable via
  `POST /admin/reload-keys`. Not persisted. The llm-proxy logs only the
  SHA-256 fingerprint (first 12 hex chars) and never the raw key.

`SECURITY.md` at the repo root lists hardening defaults for deployment.
