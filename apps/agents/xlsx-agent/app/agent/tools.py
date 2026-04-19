TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "list_templates",
            "description": (
                "List all available starting-point Python templates. Each entry "
                "has a name and a description of when it's the best starting "
                "point. Call this first to decide which template to adapt."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_template",
            "description": (
                "Read the full source code of a template by name. Use this to "
                "examine the base class or richer templates before writing "
                "your adapted script."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Template name (e.g. 'base', 'financial_model', 'invoice', 'project_tracker', 'data_report')",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_script",
            "description": (
                "Write the Python script that will build the workbook. The "
                "script must read its output path from sys.argv[1] and save "
                "the workbook to that path. Typically you copy the chosen "
                "template and modify it. Calling this replaces any previously "
                "written script for this job."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Complete Python source for the script.",
                    },
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_script",
            "description": (
                "Execute the script written by write_script. Returns success "
                "plus stdout/stderr, or an error message on failure. On error, "
                "analyze the output, call write_script again with a fixed "
                "version, then run_script again."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "finalize",
            "description": (
                "Mark the workbook complete and return its final filename. "
                "Only call this after run_script has succeeded. The output "
                "file is already saved — this just records the filename to "
                "return to the caller."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Output filename (e.g. 'q2-sales-report.xlsx')",
                    },
                },
                "required": ["filename"],
            },
        },
    },
]
