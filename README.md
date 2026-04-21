# Team Suzie

**Ship an agentic app this afternoon. Bring a coding assistant; Team Suzie brings the scaffolding.**

You're a product expert, a domain expert, a founder — someone who knows exactly what the agent should *do* but doesn't want to spend two weeks wiring up auth, chat UIs, approval flows, and knowledge bases before you get there. This repo is for you. Clone it, point your coding assistant at it, and describe what you want to build.

The hosted version lives at [teamsuzie.com](https://teamsuzie.com). This repo is the open-source core — evolving quickly, usable today.

---

## Build your app in four steps

### 1. Install a coding assistant

You'll be describing your app in English; the assistant does the wiring. Any of these work — pick one:

- [Claude Code](https://claude.com/claude-code) — Anthropic's CLI, runs in your terminal or IDE
- [Codex](https://github.com/openai/codex) — OpenAI's coding CLI
- [OpenCode](https://opencode.ai) — open-source, provider-agnostic

Install it, sign in, and make sure `claude`, `codex`, or `opencode` runs in your terminal.

### 2. Clone this repo

```bash
git clone https://github.com/firelex/teamsuzie
cd teamsuzie
pnpm install
```

If you don't have `pnpm`, install it first: `npm install -g pnpm`. No need to read the code — your assistant will.

### 3. Pick a starter template

Two templates live in `apps/starters/`. Copy one, rename it, and make it yours.

| If you want… | Use this starter | Notes |
|---|---|---|
| A chat app on **any OpenAI-compatible backend** (OpenAI, Anthropic via proxy, local models, our `llm-proxy`) | [`starter-chat`](apps/starters/starter-chat) | Simplest path. No agent-runtime lock-in. |
| A chat app on an **OpenClaw agent runtime** (session continuity, tool use, Team Suzie skills) | [`starter-chat-openclaw`](apps/starters/starter-chat-openclaw) | Use this if you want the full Team Suzie + [OpenClaw](https://github.com/openclaw) path. |
| An **internal tool / ops console** (tables, auth-guarded pages, admin panel, agent drawer) | [`starter-ops-console`](apps/starters/starter-ops-console) | Pick this when your app is mostly a tool with an agent attached. Destructive actions gated through the approval queue by default. |

Both are small Express + React apps that stream chat. They're meant to be copied and extended.

### 4. Pick a backend

You have two options — your assistant can set either one up:

- **Standalone** — run Team Suzie's services (`auth`, `llm-proxy`, `vector-db`, `graph-db`) directly from this repo. Tell your assistant: *"set up the standalone backend from the README quickstart."*
- **On OpenClaw** — run the Team Suzie pillars inside an [OpenClaw](https://github.com/openclaw) runtime for full agent-loop execution, tool use, and session management. Tell your assistant: *"wire my starter to an OpenClaw backend."*

Start standalone if you're unsure. Moving to OpenClaw later is mostly a config swap.

### 5. Prompt your assistant

Open the repo in your coding assistant and describe what you want. Examples that work:

> *"I want a customer-support agent for a SaaS company. Use `starter-chat` as the base. It should answer questions about our pricing and refund policy — I'll paste those in. Deploy locally first."*

> *"Turn `starter-chat-openclaw` into a sales research agent. It looks up companies, drafts outreach emails, and routes every email through the approval queue before sending."*

> *"Build a meeting-notes assistant on `starter-chat`. I upload a transcript, it summarizes and saves to the knowledge base so I can query past meetings later."*

> *"Make me an internal HR assistant. It answers policy questions from a knowledge base I'll populate, and it can file time-off requests — but time-off has to go through human approval."*

Your assistant will read the repo, ask what it needs (API keys, policies, branding), and build from there. If it gets stuck, tell it what's wrong; it'll adjust.

---

## What Team Suzie gives you, out of the box

So you don't rebuild any of this:

- **Auth** — multi-tenant sessions for browsers plus optional bearer tokens for app clients (orgs, users, agents) so your app is shippable to more than one customer on day one.
- **LLM proxy** — one endpoint, many providers, per-agent usage tracking.
- **Skill runtime** — installable capabilities you (or your assistant) drop into an agent's workspace. Composable; no monolithic tool registry.
- **Approval queue** — a primitive for "agent proposes, human approves." Pluggable dispatchers (email, Slack, webhooks, your call).
- **Scoped knowledge bases** — vector search (Milvus) + graph (Neo4j) with per-agent / per-org / global scopes.
- **Chat starters** — the two templates above, already wired for streaming and session handling.

You'll use some of these; you won't need to write any of them.

---

## For platform engineers

If you're building the substrate rather than the product on top, the rest of this README is for you.

### The five pillars

1. **Multi-tenant by default.** Every piece of state — knowledge, config, skills, approvals — is scoped `global / org / agent`. An agent queries its own scope plus its org's, transparently.
2. **Skill runtime.** Skills are discoverable, installable, versioned capabilities shipped as templates (instructions + files) injected into an agent's workspace.
3. **Human-in-the-loop approvals.** Reusable approval queue with a pluggable dispatcher interface. Generic by design — no provider-specific code in the core.
4. **Scoped knowledge bases.** Vector + graph with the same scope model. One agent, three hierarchical knowledge sources, one query.
5. **Multi-tenant control plane.** Session auth with org/user/agent identity, scoped config inheritance, LLM proxy that attributes every token.

### Standalone backend quickstart

```bash
cp .env.example .env
pnpm docker:up        # postgres, redis, milvus, neo4j
pnpm dev:auth         # :3005
pnpm dev:llm-proxy    # :4000
pnpm dev:vector-db    # :3006
pnpm dev:graph-db     # :3007
```

A `curl`-driven tour lives in [docs/QUICKSTART.md](docs/QUICKSTART.md). Full architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Roadmap in [docs/ROADMAP.md](docs/ROADMAP.md).

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your agent                        │
│      (OpenClaw today; adapters planned for others)   │
└─────────────────────────────────────────────────────┘
           ▲                ▲               ▲
           │                │               │
  ┌────────┴────────┐  ┌────┴─────┐  ┌──────┴──────┐
  │   Skill runtime │  │ Approval │  │  Knowledge  │
  │   (packages/    │  │  queue   │  │   (vector   │
  │    skills)      │  │          │  │   + graph)  │
  └─────────────────┘  └──────────┘  └─────────────┘
           ▲                ▲               ▲
           └────────────────┴───────────────┘
                            │
              ┌─────────────┴─────────────┐
              │  Auth + config + LLM proxy │
              │   (multi-tenant substrate) │
              └────────────────────────────┘
```

### Packages

| Package | Purpose |
|---|---|
| `@teamsuzie/types` | Shared TypeScript types (scopes, agent context) |
| `@teamsuzie/shared-auth` | Multi-tenant auth models (org, user, agent) |
| `@teamsuzie/skills` | Headless skill runtime — discovery, template rendering, pluggable target |
| `@teamsuzie/approvals` | Approval queue state machine with pluggable store & dispatchers |
| `@teamsuzie/db-client` | Typed clients for vector-db and graph-db services |
| `@teamsuzie/usage-tracker` | Redis-backed LLM usage event publisher |
| `@teamsuzie/config-client` | Scoped config resolver |
| `@teamsuzie/ui` | Shared React component library |

### Apps

```text
apps/platform  # core services and admin shell
apps/starters  # starter templates and demos
apps/agents    # capability services like pptx/xlsx generation
```

| App | Port | Purpose |
|---|---|---|
| `auth` | 3005 | Session-based multi-tenant auth |
| `llm-proxy` | 4000 | LLM routing with usage tracking |
| `vector-db` | 3006 | Scoped Milvus vector search |
| `graph-db` | 3007 | Scoped Neo4j graph queries |
| `pptx-agent` | 3009 | LLM-powered PowerPoint generation |
| `xlsx-agent` | 3012 | LLM-powered spreadsheet generation |
| `admin` | 3008 | Minimal admin shell + browser chat console |
| `starter-chat` | 16311 | Generic full-stack chat starter |
| `starter-chat-openclaw` | 14311 | OpenClaw-oriented chat starter |
| `starter-ops-console` | 18311 | Internal-tool / ops-console starter with approval-gated destructive actions |

---

## License

MIT. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
