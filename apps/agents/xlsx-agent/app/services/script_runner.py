import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from app.config import settings
from app.services.template_registry import library_path


@dataclass
class ScriptResult:
    success: bool
    stdout: str
    stderr: str
    output_path: Path | None
    error: str | None = None


def write_script(job_dir: Path, code: str) -> Path:
    job_dir = job_dir.resolve()
    job_dir.mkdir(parents=True, exist_ok=True)
    script_path = job_dir / "script.py"
    script_path.write_text(code, encoding="utf-8")
    # Make `from xlsx_builder import ...` resolve at runtime by dropping the
    # library next to the script. Python adds the script's directory to
    # sys.path[0] automatically when executing a file.
    lib_src = library_path()
    lib_dst = job_dir / lib_src.name
    shutil.copyfile(lib_src, lib_dst)
    return script_path


def run_script(job_dir: Path) -> ScriptResult:
    """
    Execute script.py in the job directory.

    Contract with the generated script:
      - It receives the absolute output xlsx path as sys.argv[1]
      - It must save the workbook to that path
      - It runs with cwd = job_dir
    """
    job_dir = job_dir.resolve()
    script_path = job_dir / "script.py"
    if not script_path.exists():
        return ScriptResult(
            success=False,
            stdout="",
            stderr="",
            output_path=None,
            error="No script.py in job directory. Call write_script first.",
        )

    output_path = job_dir / "result.xlsx"
    if output_path.exists():
        output_path.unlink()

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path), str(output_path)],
            cwd=str(job_dir),
            capture_output=True,
            text=True,
            timeout=settings.script_timeout_seconds,
        )
    except subprocess.TimeoutExpired as e:
        return ScriptResult(
            success=False,
            stdout=e.stdout or "",
            stderr=e.stderr or "",
            output_path=None,
            error=f"Script exceeded {settings.script_timeout_seconds}s timeout",
        )

    if proc.returncode != 0:
        return ScriptResult(
            success=False,
            stdout=proc.stdout,
            stderr=proc.stderr,
            output_path=None,
            error=f"Script exited with code {proc.returncode}",
        )

    if not output_path.exists():
        return ScriptResult(
            success=False,
            stdout=proc.stdout,
            stderr=proc.stderr,
            output_path=None,
            error=(
                "Script completed but did not write the output file. "
                "Make sure the script saves the workbook to sys.argv[1]."
            ),
        )

    return ScriptResult(
        success=True,
        stdout=proc.stdout,
        stderr=proc.stderr,
        output_path=output_path,
    )
