from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MARKITDOWN_AGENT_", env_file=".env", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 3013
    # Per-file upload cap. Default 50MB; raise for big PDFs.
    max_upload_bytes: int = 50 * 1024 * 1024
    # Pandoc DOCX --reference-doc, optional path. Apps that want firm-template fidelity point this at a styled .docx.
    reference_docx: str | None = None


settings = Settings()
