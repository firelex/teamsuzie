---
name: spreadsheets
description: Create, convert, and manipulate Excel workbooks (XLSX). Use this skill when asked to create spreadsheets, financial models, invoices, trackers, data reports, convert between CSV and XLSX, or work with any .xlsx file.
---

# Spreadsheets Skill

Everything spreadsheet-related lives behind one base URL. Two kinds of operations:

- **Generate** — create a new workbook from a natural-language prompt. **Asynchronous** (30–120s). Returns a `job_id` immediately; webhook fires on completion.
- **Convert** — mechanical format conversions (CSV ↔ XLSX). **Synchronous** (sub-second). Returns the completed download URL in the response.

Both kinds use the **same download flow**: server returns `{ job_id, download_url, filename }`, you fetch the URL, save to workspace, send the file to the user. Never stream file contents directly into chat — always download to the workspace and attach as a file.

## Base URL

```
{{XLSX_AGENT_URL}}
```

## Authentication

All requests require this header:
```
X-API-Key: {{AGENT_API_KEY}}
```

---

## 1. Generate (async)

Create a new workbook from natural-language instructions.

**Method:** POST
**Endpoint:** `/api/spreadsheets/generate`
**Content-Type:** `application/json`

```json
{
  "instructions": "Create a 3-statement financial model for a SaaS company with $2M ARR, 80% gross margin, and 30% YoY growth"
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "a1b2c3d4-...",
  "status": "processing"
}
```

**IMPORTANT:** Do NOT wait for the response before replying. Quote the job id, tell the user you'll notify them when it's done, and continue the conversation.

## 2. Convert CSV → XLSX (sync)

**Method:** POST
**Endpoint:** `/api/spreadsheets/csv-to-xlsx`
**Content-Type:** `multipart/form-data`

| Field        | Required | Description                                        |
| ------------ | -------- | -------------------------------------------------- |
| `file`       | Yes      | The CSV file                                       |
| `sheet_name` | No       | Generated sheet name (default: `Sheet1`)           |
| `delimiter`  | No       | Delimiter override. Auto-sniffed by default.       |

Response includes `download_url` — proceed to §4.

## 3. Convert XLSX → CSV (sync)

**Method:** POST
**Endpoint:** `/api/spreadsheets/xlsx-to-csv`
**Content-Type:** `multipart/form-data`

| Field   | Required | Description                                          |
| ------- | -------- | ---------------------------------------------------- |
| `file`  | Yes      | The XLSX file                                        |
| `sheet` | No       | Sheet name or 0-indexed integer. Defaults to first.  |

Response includes `download_url` — proceed to §4.

## 4. Download and deliver

**Method:** GET
**Endpoint:** `/api/spreadsheets/:id/download`

Returns the binary file. Available once `status` is `completed`.

### Agent procedure

1. Parse the `download_url` from the response (or webhook text for generate).
2. Save the file:
   ```bash
   mkdir -p /tmp/workspace/{{AGENT_SLUG}}
   curl -o /tmp/workspace/{{AGENT_SLUG}}/result.xlsx <download_url>
   ```
3. Attach the file via the message tool with `filePath`.

Never paste file contents into chat. Never send download URLs to the user as text.

## Context variables

- `{{XLSX_AGENT_URL}}` — base URL of the spreadsheets service
- `{{AGENT_API_KEY}}` — API key this agent uses to authenticate
- `{{AGENT_SLUG}}` — this agent's slug, for workspace path segmentation
