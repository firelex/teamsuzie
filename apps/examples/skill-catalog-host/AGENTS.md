# AGENTS.md

Guidance for `apps/examples/skill-catalog-host`.

This app is a reference external skill catalog. Its job is to prove the
`HttpSkillSource` contract, not to become a marketplace.

## Rules

- Keep it tiny and easy to inspect.
- Serve static example skills from `catalog/`.
- Keep `access: "paid"` as metadata only. Do not add billing, checkout,
  entitlement enforcement, or commercial account state here.
- Return raw skill templates from `GET /skills/:slug`; the client renders
  placeholders locally.
- Do not require a database, Redis, private services, or network dependencies.
- Do not add customer-specific examples.
- Keep path handling conservative and reject unsafe slugs.

## Tests

Run:

```bash
pnpm --filter @teamsuzie/skill-catalog-host typecheck
pnpm --filter @teamsuzie/skill-catalog-host build
pnpm --filter @teamsuzie/skill-catalog-host start
```

Smoke-test with:

```bash
curl -s http://127.0.0.1:3021/skills
curl -s http://127.0.0.1:3021/skills/research-helper
```
