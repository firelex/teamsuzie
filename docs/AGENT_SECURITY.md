# Agent Guide: Security

Use this before editing auth, config, skills, approvals, file handling, network
calls, or tenant-scoped data.

## Core Rules

- Preserve tenant boundaries. State is scoped `global`, `org`, or `agent`; do not
  bypass those scopes.
- Do not log secrets, bearer tokens, API keys, session cookies, CSRF values, or
  rendered config containing secrets.
- Do not send agent render context to remote skill catalogs. Fetch raw templates
  and render locally.
- Do not execute code at skill install time. Skills are data: `SKILL.md` plus
  optional support files.
- Treat prompt injection in skill templates as a real security issue.
- Keep privileged admin routes authenticated and actor-attributed.
- Use existing auth/session/request-id helpers instead of custom auth parsing.
- Validate path inputs and prevent path traversal on every file write.
- Keep LLM proxy and internal service routes protected by the existing auth lanes.

## Security-Sensitive Areas

- `packages/skills`
- `packages/shared-auth`
- `packages/approvals`
- `apps/platform/admin/src/routes`
- `apps/platform/admin/src/controllers`
- `apps/platform/admin/src/services/config.ts`
- `apps/platform/llm-proxy`
- `apps/platform/vector-db`
- `apps/platform/graph-db`

## Required Review Questions

Before finishing a security-sensitive change, answer these for yourself:

- Can this leak data across orgs or agents?
- Can user input become a filesystem path, shell command, SQL/Cypher fragment, or
  prompt instruction without validation?
- Can this expose a secret in logs, responses, rendered skills, or browser state?
- Does this introduce a new network call? If so, is auth explicit and are secrets
  kept out of URLs?
- Does this change need an audit log or activity entry?
- Is there a focused test for the risky behavior?

## Further Reading

- `SECURITY.md`
- `docs/SECURITY_MODEL.md`
- `docs/UPLOADS.md`
