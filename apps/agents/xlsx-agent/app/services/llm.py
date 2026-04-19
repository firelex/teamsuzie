from typing import Any

import httpx

from app.config import settings


async def call_llm(messages: list[dict], tools: list[dict], model: str) -> dict:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.llm_key:
        headers["Authorization"] = f"Bearer {settings.llm_key}"

    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "tools": tools,
        "max_tokens": 16384,
    }

    async with httpx.AsyncClient(timeout=settings.llm_call_timeout_seconds) as client:
        res = await client.post(
            f"{settings.llm_proxy_url}/v1/chat/completions",
            headers=headers,
            json=body,
        )
        if res.status_code >= 400:
            raise RuntimeError(f"LLM proxy error {res.status_code}: {res.text}")
        return res.json()
