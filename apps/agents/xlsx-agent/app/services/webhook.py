import logging
from typing import Mapping

import httpx

from app.config import settings

log = logging.getLogger("xlsx-agent.webhook")


def get_agent_api_key(headers: Mapping[str, str]) -> str | None:
    lower = {k.lower(): v for k, v in headers.items()}
    candidates = [
        lower.get("x-api-key"),
        lower.get("x-agent-api-key"),
    ]
    auth = lower.get("authorization")
    if auth and auth.startswith("Bearer "):
        candidates.append(auth[len("Bearer ") :])
    for c in candidates:
        if c and c.startswith("dtk_"):
            return c
    return None


async def _resolve_webhook(agent_api_key: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"{settings.admin_api_url}/api/agents/resolve-by-key",
            headers={"X-Agent-API-Key": agent_api_key},
        )
        if res.status_code >= 400:
            raise RuntimeError(f"resolve-by-key returned HTTP {res.status_code}")
        return res.json()


def _background_session_key(openclaw_agent_id: str, workflow: str) -> str:
    """Dedicated background session for this workflow.

    Execution stays here regardless of where delivery lands. Even when
    the primary deliver target is a Matrix room, the spreadsheet
    completion must NOT run on that room's interactive session
    (`agent:<slug>:matrix:channel:<roomId>`) — doing so would serialize
    with live chat in that room. The delivery layer routes the outbound
    reply to the room via the separate `channel` + `to` webhook fields.
    """
    return f"agent:{openclaw_agent_id}:bg:{workflow}"


async def _fire_agent_webhook(
    agent_api_key: str,
    message: str,
    job_id: str,
    delivery_mode: str,
) -> None:
    """
    Shared helper: resolve the agent's webhook and POST a message to it.
    Used by both completion and failure paths — the only difference between
    them is the text of the message.
    """
    data = await _resolve_webhook(agent_api_key)

    openclaw_agent_id = (data.get("openclaw_agent_id") or "").strip()
    deliver_targets = data.get("deliver_targets") or []
    webhook_url = data.get("webhook_url")
    token = (data.get("webhook_token") or "").strip()

    if not webhook_url:
        raise RuntimeError("Agent has no webhook_url")
    if not openclaw_agent_id:
        raise RuntimeError("Missing openclaw_agent_id")
    if not deliver_targets:
        raise RuntimeError("No deliver_targets — agent has no channel bindings")

    primary = deliver_targets[0]
    hook_agent_url = webhook_url.replace("/hooks/wake", "/hooks/agent")
    session_key = _background_session_key(openclaw_agent_id, "spreadsheets")

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = {
        "name": "XlsxAgent",
        "message": message,
        "wakeMode": "now",
        "agentId": openclaw_agent_id,
        "accountId": openclaw_agent_id,
        "sessionKey": session_key,
    }

    if delivery_mode == "cron-direct":
        body["deliver"] = True
        body["channel"] = primary.get("channel")
        body["to"] = primary.get("to")

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(hook_agent_url, headers=headers, json=body)
        if res.status_code >= 400:
            raise RuntimeError(
                f"hooks/agent failed (status={res.status_code}) {res.text}".strip()
            )
    log.info(
        "[WEBHOOK] Fired for job %s → %s (mode=%s, status=%s)",
        job_id,
        hook_agent_url,
        delivery_mode,
        res.status_code,
    )


async def fire_completion_webhook(
    job_id: str,
    filename: str,
    download_url: str,
    agent_api_key: str,
) -> None:
    data = await _resolve_webhook(agent_api_key)
    deliver_targets = data.get("deliver_targets") or []
    primary_to = deliver_targets[0].get("to") if deliver_targets else "current"

    text = (
        f'Spreadsheet ready: "{filename}" completed. '
        f"Job ID: {job_id}. Download: {download_url} (filename: {filename})\n\n"
        "Required delivery behavior for this turn — attachment via message tool ONLY:\n"
        f'1) Download the file into your workspace using the download URL (e.g. exec curl -fL "{download_url}" -o /tmp/{filename}).\n'
        f'2) Call the message tool ONCE with to="{primary_to}", a short caption, and filePath set to the downloaded file — this uploads the spreadsheet as an attachment.\n'
        "3) Do not send the download link as text, do not paste execution logs, do not describe the file. The attachment IS the reply.\n"
        "4) If the message tool fails, report the exact failure — do not fall back to pasting the URL."
    )
    await _fire_agent_webhook(agent_api_key, text, job_id, "message-tool")


async def fire_failure_webhook(
    job_id: str,
    error_summary: str,
    agent_api_key: str,
) -> None:
    """
    Fire a webhook when a spreadsheet job FAILS. Without this, the agent
    is left waiting indefinitely for a completion webhook that never
    arrives and has no idea the job broke. A plain failure message lets
    the agent apologize, show the error to the user, and optionally
    retry with adjusted parameters.
    """
    text = (
        f"Spreadsheet job failed. Job ID: {job_id}.\n"
        f"Error: {error_summary}\n\n"
        "Required delivery behavior for this turn:\n"
        "1) Tell the user the spreadsheet generation failed and briefly explain why.\n"
        "2) Offer to retry with adjusted parameters (simpler prompt, different template, etc.).\n"
        "3) Do NOT pretend the file exists — there is no download URL for a failed job."
    )
    await _fire_agent_webhook(agent_api_key, text, job_id, "cron-direct")
