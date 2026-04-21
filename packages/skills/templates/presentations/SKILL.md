---
name: presentations
description: Create professional PPTX slide decks. Use this skill when asked to create presentations, pitch decks, or slide decks.
---

# Presentations Skill

Create PowerPoint presentations via the PPTX agent. The operation is **asynchronous** — the API accepts the request immediately, returns a `job_id`, and generates the presentation in the background. When complete, a webhook fires to the runtime with the job id and download URL.

## Base URL

```
{{PPTX_AGENT_URL}}
```

## Authentication

All requests require this header:
```
X-API-Key: {{AGENT_API_KEY}}
```

---

## Flow

1. Agent calls `POST /api/presentations/generate`
2. Server returns `202 Accepted` with a `job_id`
3. Agent confirms to the user that the presentation is being prepared
4. Server generates the presentation in the background (60–120 seconds)
5. On completion, webhook fires to the runtime with `job_id` and `download_url`
6. Agent downloads the result via `GET /api/presentations/:id/download`
7. Agent attaches the `.pptx` file via the message tool

**IMPORTANT:** Do NOT wait for the response before replying to the user. Tell them you've submitted the request (quote the job id) and that you'll notify them when it's ready.

---

## 1. Generate a presentation

**Method:** POST
**Endpoint:** `/api/presentations/generate`
**Content-Type:** `application/json`

```json
{
  "instructions": "Create a 10-slide presentation about AI agent security best practices"
}
```

| Field          | Required | Description                                                  |
| -------------- | -------- | ------------------------------------------------------------ |
| `instructions` | Yes      | Natural-language instructions for the presentation to create |

**Response (202 Accepted):**
```json
{
  "job_id": "a1b2c3d4-...",
  "status": "processing"
}
```

## 2. Check status (optional)

**Method:** GET
**Endpoint:** `/api/presentations/:id/status`

Use only if the user asks about progress before the webhook arrives.

## 3. Download

**Method:** GET
**Endpoint:** `/api/presentations/:id/download`

Returns the binary `.pptx`. Available as soon as `status` is `completed`.

### Agent procedure

1. Always write JSON payloads to a file, then pass to curl with `--data-binary @file`.
2. Call `POST /api/presentations/generate`.
3. Tell the user: "I've submitted the presentation request (Job ID: xxx). I'll let you know as soon as it's ready."
4. Continue the conversation — do not block or wait.
5. When the webhook arrives with "Presentation ready" and the matching job id:
   - Parse the `download_url` from the webhook text.
   - Download the PPTX to the workspace:
     ```bash
     mkdir -p /tmp/workspace/{{AGENT_SLUG}}
     curl -o /tmp/workspace/{{AGENT_SLUG}}/presentation.pptx <download_url>
     ```
   - Attach the file via the message tool with `filePath`.
   - Do NOT send URLs or raw contents as text.

## Context variables

- `{{PPTX_AGENT_URL}}` — base URL of the presentations service
- `{{AGENT_API_KEY}}` — API key this agent uses to authenticate
- `{{AGENT_SLUG}}` — this agent's slug, for workspace path segmentation
