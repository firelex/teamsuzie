# pptx-agent

LLM-powered PowerPoint generator built on `PptxGenJS`.

## What it does

- Accepts presentation instructions over HTTP
- Runs an agent loop against the configured LLM proxy
- Generates `.pptx` files and stores them per job
- Exposes job status and download endpoints
- Optionally notifies an agent webhook when a deck is ready

## Run

```bash
cp apps/agents/pptx-agent/.env.example apps/agents/pptx-agent/.env
pnpm dev:pptx-agent
```

For one-off generation:

```bash
cd apps/agents/pptx-agent
pnpm cli "Create a 5-slide product overview deck"
```

## Notes

- `DEFAULT_LLM_MODEL` must be set unless `PPTX_AGENT_MODEL` is provided.
- Slide preview generation depends on LibreOffice and `pdftoppm`.
- Webhook delivery depends on an admin service implementing `GET /api/agents/resolve-by-key`.
