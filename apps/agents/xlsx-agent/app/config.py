import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent


def _resolve_default_model() -> str:
    """
    Fallback used by pydantic's default_factory when neither
    `XLSX_AGENT_MODEL` nor `DEFAULT_LLM_MODEL` is set in the environment.

    Called only if `XLSX_AGENT_MODEL` is unset (pydantic reads that one
    via `env_prefix='XLSX_AGENT_'`). This function checks the
    platform-wide `DEFAULT_LLM_MODEL` and throws loudly if it's also
    missing — a silent default would hide misconfiguration.
    """
    v = (os.environ.get("DEFAULT_LLM_MODEL") or "").strip()
    if not v:
        raise RuntimeError(
            "xlsx-agent: DEFAULT_LLM_MODEL environment variable is required "
            "(e.g. `dashscope/qwen3.6-plus`). XLSX_AGENT_MODEL is accepted as "
            "an xlsx-specific override."
        )
    return v


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 3012
    # Model: pydantic reads XLSX_AGENT_MODEL via env_prefix first, and
    # falls back to _resolve_default_model (which reads DEFAULT_LLM_MODEL
    # and throws if unset). Both paths flow through validation so the
    # value is a plain string on `settings.model` at import time.
    model: str = Field(default_factory=_resolve_default_model)
    llm_key: str = "xlsx-agent"
    llm_proxy_url: str = "http://localhost:4000"
    admin_api_url: str = "http://localhost:3008"
    python_tools_url: str = "http://localhost:3004"
    public_base_url: str = "http://localhost:3012"
    output_dir: Path = PROJECT_DIR / "output"
    templates_dir: Path = PROJECT_DIR / "templates"
    max_iterations: int = 20
    script_timeout_seconds: int = 60
    # httpx ReadTimeout for LLM proxy calls. Qwen/Claude can occasionally
    # take >60s on long generations (multi-sheet xlsx with many tool
    # calls); 300s gives comfortable headroom without letting a truly
    # stuck request hang forever.
    llm_call_timeout_seconds: float = 300.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_prefix = "XLSX_AGENT_"
        extra = "ignore"


settings = Settings()

# Also honor shared env vars that don't use the prefix
if os.environ.get("LLM_PROXY_URL"):
    settings.llm_proxy_url = os.environ["LLM_PROXY_URL"].rstrip("/")
if os.environ.get("ADMIN_API_URL"):
    settings.admin_api_url = os.environ["ADMIN_API_URL"].rstrip("/")
if os.environ.get("PYTHON_TOOLS_URL"):
    settings.python_tools_url = os.environ["PYTHON_TOOLS_URL"].rstrip("/")
if os.environ.get("PUBLIC_BASE_URL"):
    settings.public_base_url = os.environ["PUBLIC_BASE_URL"].rstrip("/")

settings.output_dir.mkdir(parents=True, exist_ok=True)
