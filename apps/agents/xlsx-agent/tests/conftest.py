"""Shared test fixtures."""

from pathlib import Path

import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def isolated_output_dir(tmp_path: Path, monkeypatch):
    """Point every test at a fresh output dir so jobs don't collide."""
    test_output = tmp_path / "output"
    test_output.mkdir()
    monkeypatch.setattr(settings, "output_dir", test_output)
    yield test_output


@pytest.fixture(autouse=True)
def clear_jobs():
    """Wipe the in-memory JOBS dict between tests."""
    from app.main import JOBS
    JOBS.clear()
    yield
    JOBS.clear()
