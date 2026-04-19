import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable

from app.agent.system_prompt import build_system_prompt
from app.agent.tools import TOOL_DEFINITIONS
from app.config import settings
from app.services.llm import call_llm
from app.services.script_runner import run_script, write_script
from app.services.template_registry import list_templates, read_template

log = logging.getLogger("xlsx-agent.loop")

ProgressCallback = Callable[[str], None]


@dataclass
class AgentResult:
    file_path: Path
    filename: str


async def _handle_tool_call(
    name: str,
    args: dict,
    job_dir: Path,
    state: dict,
) -> str:
    if name == "list_templates":
        return json.dumps({"templates": list_templates()})

    if name == "read_template":
        template_name = args.get("name", "")
        try:
            source = read_template(template_name)
            return json.dumps({"name": template_name, "source": source})
        except ValueError as e:
            return json.dumps({"error": str(e)})

    if name == "write_script":
        code = args.get("code", "")
        if not code:
            return json.dumps({"error": "Missing 'code' argument"})
        path = write_script(job_dir, code)
        return json.dumps({"success": True, "script_path": str(path), "bytes": len(code)})

    if name == "run_script":
        result = run_script(job_dir)
        payload: dict = {
            "success": result.success,
            "stdout": result.stdout[-4000:],
            "stderr": result.stderr[-4000:],
        }
        if result.error:
            payload["error"] = result.error
        if result.output_path:
            payload["output_path"] = str(result.output_path)
            state["last_output_path"] = result.output_path
        return json.dumps(payload)

    if name == "finalize":
        filename = args.get("filename", "workbook.xlsx")
        if not filename.endswith(".xlsx"):
            filename += ".xlsx"
        output_path: Path | None = state.get("last_output_path")
        if not output_path or not output_path.exists():
            return json.dumps({
                "success": False,
                "error": "No successful run_script output to finalize. Run the script first.",
            })
        state["final_filename"] = filename
        state["finalized"] = True
        return json.dumps({
            "success": True,
            "filename": filename,
            "file_path": str(output_path),
        })

    return json.dumps({"error": f"Unknown tool: {name}"})


async def run_agent_loop(
    user_prompt: str,
    job_dir: Path,
    model: str | None = None,
    on_progress: ProgressCallback | None = None,
) -> AgentResult:
    active_model = model or settings.model
    log_fn = on_progress or (lambda m: log.info("[AGENT] %s", m))

    log_fn(f"Starting with model: {active_model}")

    messages: list[dict] = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": user_prompt},
    ]

    state: dict = {}

    for iteration in range(settings.max_iterations):
        log_fn(f"Iteration {iteration + 1}/{settings.max_iterations}")

        response = await call_llm(messages, TOOL_DEFINITIONS, active_model)
        choice = response["choices"][0]
        assistant_msg = choice["message"]

        history_msg: dict = {
            "role": "assistant",
            "content": assistant_msg.get("content") or "",
        }
        if assistant_msg.get("tool_calls"):
            history_msg["tool_calls"] = assistant_msg["tool_calls"]
        messages.append(history_msg)

        content = assistant_msg.get("content")
        if content:
            snippet = content if len(content) <= 400 else content[:400] + "…"
            log_fn(f"Assistant: {snippet}")

        tool_calls = assistant_msg.get("tool_calls") or []
        if not tool_calls:
            log_fn("Agent finished without calling finalize.")
            break

        for tool_call in tool_calls:
            fn = tool_call["function"]
            name = fn["name"]
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}

            log_fn(f"Tool: {name}")
            result_str = await _handle_tool_call(name, args, job_dir, state)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": result_str,
            })

            if state.get("finalized"):
                output_path = state["last_output_path"]
                filename = state["final_filename"]
                log_fn(f"Workbook saved: {output_path}")
                return AgentResult(file_path=output_path, filename=filename)

    raise RuntimeError("Agent exceeded maximum iterations without finalizing the workbook")
