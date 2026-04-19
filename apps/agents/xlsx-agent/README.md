# xlsx-agent

LLM-powered spreadsheet generator built with FastAPI and `openpyxl`.

## What it does

- Accepts spreadsheet instructions over HTTP
- Runs an agent loop that adapts Python workbook templates
- Executes the generated script in a per-job workspace
- Returns `.xlsx` downloads through job status endpoints
- Optionally proxies CSV/XLSX conversion through an external conversion service

## Setup

```bash
cd apps/agents/xlsx-agent
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

## Run

```bash
pnpm dev:xlsx-agent
```

## Test

```bash
cd apps/agents/xlsx-agent
python3 -m pytest
```

## Notes

- `DEFAULT_LLM_MODEL` must be set unless `XLSX_AGENT_MODEL` is provided.
- `PYTHON_TOOLS_URL` is only used for the optional CSV/XLSX conversion proxy endpoints.
- Webhook delivery depends on an admin service implementing `GET /api/agents/resolve-by-key`.
