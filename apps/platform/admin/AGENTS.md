# AGENTS.md

Guidance for `apps/platform/admin`.

The admin app is the operator control plane. It wires together agents, skills,
approvals, config, usage, workspace files, and activity. It should orchestrate
core packages rather than hiding product logic inside them.

## Rules

- Keep route handlers thin. Prefer controller/service separation already used in
  `src/controllers` and `src/services`.
- Use shared auth/session/request-id/actor helpers. Do not hand-roll auth.
- Privileged mutations should be authenticated, scoped, and auditable.
- Preserve org/agent scoping on every read and write.
- Skill listings may include source/access metadata, but admin OSS must not
  enforce paid entitlements or implement billing.
- If adding remote skill sources, make them configurable and keep secrets out of
  URLs and logs.
- UI should expose useful operator state without implying OSS includes hosted
  marketplace enforcement.

## Tests

Run focused checks:

```bash
pnpm --filter @teamsuzie/admin typecheck
pnpm --filter @teamsuzie/admin-client build
pnpm --filter @teamsuzie/admin test -- skills.test.ts
```

Integration tests may require local Postgres/Redis. If a sandbox blocks
localhost, rerun with approval and mention it in the final note.
