# Agent Guide: OSS Boundary

Use this when deciding whether a feature belongs in this repo.

## Belongs In OSS

- Core skill package format and rendering.
- Local filesystem skill sources.
- HTTP skill source interfaces and example hosts.
- Install policy interfaces.
- Approval queue abstractions.
- Generic admin surfaces for agents, skills, approvals, config, usage, and
  activity.
- Generic LLM provider adapters.
- Generic vector/graph backend interfaces.
- Public-safe examples and local development fixtures.

## Belongs In Hosted/Private

- Billing, invoices, subscriptions, credits, Stripe, or payment provider code.
- Paid-skill entitlement enforcement.
- Commercial marketplace business rules.
- Managed OAuth credentials for Gmail, Outlook, Jira, Slack, or similar services.
- Customer-specific templates, prompts, contracts, outputs, or case studies.
- Production/staging deployment automation.
- Private SDKs, private GitHub dependencies, internal service URLs, and customer
  environment assumptions.

## Pattern To Prefer

Expose a small OSS interface and implement commercial behavior elsewhere.

Good:

```text
OSS: SkillInstallPolicy interface
Hosted: Entitlement-backed SkillInstallPolicy implementation
```

Good:

```text
OSS: HttpSkillSource and external catalog example
Hosted: Authenticated paid catalog that serves only entitled bundles
```

Bad:

```text
OSS: Stripe checkout flow inside packages/skills
OSS: paid_skill_entitlements table in shared core
OSS: hosted Team Suzie URLs as defaults
```

## Paid Skills Rule

OSS may know that a listing has `access: "paid"` because that is useful metadata.
OSS must not decide whether money has been paid. A hosted catalog or hosted
policy decides what the caller may install.

Downloaded skills are copyable. Real commercial value should be enforced through
hosted distribution, managed APIs, updates, support, and execution-time checks in
hosted services.
