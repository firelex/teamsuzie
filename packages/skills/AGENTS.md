# AGENTS.md

Guidance for `packages/skills`.

This package is the headless skill runtime. Keep it small, portable, and free of
product-specific business logic.

## Rules

- Skills are data. Do not execute code during discovery, rendering, or install.
- Keep billing, entitlement storage, Stripe, checkout flows, and commercial
  marketplace rules out of this package.
- `SkillInstallPolicy` is an interface hook. The OSS default should remain
  allow-all.
- `SkillSource` implementations may discover and fetch bundles, but they should
  not know commercial account state.
- `HttpSkillSource` must fetch raw templates and render placeholders locally.
  Do not send render context, API keys, or agent config to catalog hosts.
- Validate skill names and file paths. Prevent path traversal.
- Keep dependencies minimal. Prefer Node built-ins and existing local helpers.
- Preserve TypeScript strictness and public exports in `src/index.ts`.

## Tests

Run:

```bash
pnpm --filter @teamsuzie/skills test
pnpm --filter @teamsuzie/skills typecheck
pnpm --filter @teamsuzie/skills build
```

Add tests for new source, target, interpolation, path validation, or install
policy behavior.
