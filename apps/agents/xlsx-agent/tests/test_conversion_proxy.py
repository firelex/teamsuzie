"""Tests for xlsx-agent's CSV ↔ XLSX proxy endpoints and download."""

from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class _MockHTTPXClient:
    """A fake httpx.AsyncClient that returns a scripted response."""

    def __init__(self, status_code: int, content: bytes, headers: dict | None = None):
        self._status_code = status_code
        self._content = content
        self._headers = headers or {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, files=None, data=None):
        request = httpx.Request("POST", url)
        return httpx.Response(
            status_code=self._status_code,
            content=self._content,
            headers=self._headers,
            request=request,
        )


def _patch_httpx(monkeypatch, status_code: int, content: bytes, headers: dict | None = None):
    from app import main as main_module

    def fake_client_factory(*args, **kwargs):
        return _MockHTTPXClient(status_code, content, headers)

    monkeypatch.setattr(main_module.httpx, "AsyncClient", fake_client_factory)


# ── csv-to-xlsx proxy ──────────────────────────────────────────────────────


def test_csv_to_xlsx_proxy_happy_path(monkeypatch):
    fake_xlsx = b"PK\x03\x04" + b"\x00" * 100  # minimal zip header + padding
    _patch_httpx(monkeypatch, 200, fake_xlsx)

    res = client.post(
        "/api/spreadsheets/csv-to-xlsx",
        files={"file": ("sales.csv", b"a,b\n1,2\n", "text/csv")},
        data={"sheet_name": "Sales"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "completed"
    assert body["filename"] == "sales.xlsx"
    assert "job_id" in body
    assert body["download_url"].endswith(f"/api/spreadsheets/{body['job_id']}/download")


def test_csv_to_xlsx_proxy_persists_bytes_from_python_tools(monkeypatch):
    fake_xlsx = b"PK\x03\x04TESTBYTES" + b"\x00" * 50
    _patch_httpx(monkeypatch, 200, fake_xlsx)

    res = client.post(
        "/api/spreadsheets/csv-to-xlsx",
        files={"file": ("data.csv", b"x,y\n", "text/csv")},
    )
    job_id = res.json()["job_id"]

    # Download and verify bytes match
    dl = client.get(f"/api/spreadsheets/{job_id}/download")
    assert dl.status_code == 200
    assert dl.content == fake_xlsx
    assert dl.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


def test_csv_to_xlsx_proxy_propagates_python_tools_error(monkeypatch):
    _patch_httpx(
        monkeypatch,
        422,
        b'{"detail":"CSV was empty."}',
        headers={"content-type": "application/json"},
    )

    res = client.post(
        "/api/spreadsheets/csv-to-xlsx",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert res.status_code == 422
    assert "CSV was empty" in res.json()["detail"]


def test_csv_to_xlsx_proxy_python_tools_unreachable(monkeypatch):
    from app import main as main_module

    class BrokenClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda *a, **kw: BrokenClient())

    res = client.post(
        "/api/spreadsheets/csv-to-xlsx",
        files={"file": ("data.csv", b"a,b\n1,2\n", "text/csv")},
    )
    assert res.status_code == 502
    assert "unreachable" in res.json()["detail"].lower()


# ── xlsx-to-csv proxy ──────────────────────────────────────────────────────


def test_xlsx_to_csv_proxy_happy_path(monkeypatch):
    fake_csv = b"a,b\n1,2\n"
    _patch_httpx(monkeypatch, 200, fake_csv)

    res = client.post(
        "/api/spreadsheets/xlsx-to-csv",
        files={"file": ("book.xlsx", b"fake xlsx", "application/octet-stream")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "completed"
    assert body["filename"] == "book.csv"
    assert "download_url" in body


def test_xlsx_to_csv_download_returns_csv_media_type(monkeypatch):
    fake_csv = b"Region,Revenue\nNorth,1000\nSouth,2000\n"
    _patch_httpx(monkeypatch, 200, fake_csv)

    res = client.post(
        "/api/spreadsheets/xlsx-to-csv",
        files={"file": ("x.xlsx", b"fake", "application/octet-stream")},
    )
    job_id = res.json()["job_id"]

    dl = client.get(f"/api/spreadsheets/{job_id}/download")
    assert dl.status_code == 200
    # FastAPI FileResponse may append charset; just check prefix
    assert dl.headers["content-type"].startswith("text/csv")
    assert dl.content == fake_csv


def test_xlsx_to_csv_proxy_forwards_sheet_parameter(monkeypatch):
    captured_data: dict = {}
    fake_csv = b"x,y\n"

    class CapturingClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, files=None, data=None):
            captured_data.update(data or {})
            return httpx.Response(
                status_code=200,
                content=fake_csv,
                request=httpx.Request("POST", url),
            )

    from app import main as main_module
    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda *a, **kw: CapturingClient())

    res = client.post(
        "/api/spreadsheets/xlsx-to-csv",
        files={"file": ("b.xlsx", b"fake", "application/octet-stream")},
        data={"sheet": "Summary"},
    )
    assert res.status_code == 200
    assert captured_data.get("sheet") == "Summary"


# ── download endpoint ──────────────────────────────────────────────────────


def test_download_nonexistent_job_returns_404():
    res = client.get("/api/spreadsheets/nonexistent/download")
    assert res.status_code == 404


def test_download_before_ready_returns_404(monkeypatch):
    """A processing job (no file yet) should not be downloadable."""
    from app.main import JOBS, Job
    JOBS["abc"] = Job(id="abc", status="processing")
    res = client.get("/api/spreadsheets/abc/download")
    assert res.status_code == 404


def test_status_nonexistent_job_returns_404():
    res = client.get("/api/spreadsheets/nope/status")
    assert res.status_code == 404


def test_status_reports_completed_conversion(monkeypatch):
    fake_xlsx = b"PK\x03\x04" + b"\x00" * 50
    _patch_httpx(monkeypatch, 200, fake_xlsx)

    create = client.post(
        "/api/spreadsheets/csv-to-xlsx",
        files={"file": ("a.csv", b"a,b\n1,2\n", "text/csv")},
    )
    job_id = create.json()["job_id"]

    status = client.get(f"/api/spreadsheets/{job_id}/status")
    assert status.status_code == 200
    body = status.json()
    assert body["status"] == "completed"
    assert body["filename"] == "a.xlsx"
    assert body["download_url"].endswith(f"/api/spreadsheets/{job_id}/download")


# ── generate endpoint basic validation ─────────────────────────────────────


def test_generate_missing_instructions_returns_400():
    res = client.post("/api/spreadsheets/generate", json={"instructions": ""})
    assert res.status_code == 400


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "xlsx-agent"}
