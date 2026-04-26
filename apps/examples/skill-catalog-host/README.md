# Skill Catalog Host Example

This is a tiny external skill catalog for Team Suzie OSS. It demonstrates the
remote `SkillSource` wire contract without adding billing or entitlement logic
to the open repo.

```bash
pnpm --filter @teamsuzie/skill-catalog-host dev
```

The host listens on `PORT` or `3021` by default.

```bash
curl http://localhost:3021/health
curl http://localhost:3021/skills
curl http://localhost:3021/skills/research-helper
```

Routes:

- `GET /health` returns service status.
- `GET /skills` returns discoverable skill listings.
- `GET /skills/:slug` returns a raw skill bundle. The OSS `HttpSkillSource`
  renders `{{PLACEHOLDER}}` values locally before installing.

The sample includes both `free` and `paid` metadata so clients can prove the UI
path. This host still serves every sample skill. A hosted/private catalog can use
the same shape while enforcing auth, entitlements, signatures, and checkout
redirects server-side.
