from dataclasses import dataclass
from pathlib import Path

from app.config import settings


@dataclass
class Template:
    name: str
    filename: str
    description: str


LIBRARY_FILENAME = "xlsx_builder.py"


TEMPLATES: list[Template] = [
    Template(
        name="blank",
        filename="__blank__",
        description=(
            "No template — start fresh. Subclass XLSXBuilder from the "
            "xlsx_builder library and build sheets from scratch. Choose this "
            "only when the workbook doesn't resemble any of the richer "
            "templates (financial_model, invoice, project_tracker, data_report)."
        ),
    ),
    Template(
        name="financial_model",
        filename="financial_model.py",
        description=(
            "Three-statement financial model: Cover, Assumptions, Income "
            "Statement, Balance Sheet, Cash Flow. Linked statements with "
            "growth / margin / capex drivers. Choose for P&Ls, projections, "
            "DCFs, three-statement models, or any multi-year financial model."
        ),
    ),
    Template(
        name="invoice",
        filename="invoice.py",
        description=(
            "Single-sheet polished invoice form — fixed positional layout "
            "with header, bill-to/ship-to block, line items, totals, and "
            "payment-terms footer. Choose for invoices, quotes, receipts, "
            "purchase orders, or any fixed-layout document."
        ),
    ),
    Template(
        name="project_tracker",
        filename="project_tracker.py",
        description=(
            "Project tracker: Cover, Tracker (task table with Status/Priority "
            "dropdown validation, dates, progress formulas, overdue detection) "
            "and Summary with KPI tiles and milestones. Choose for task "
            "trackers, sprint boards, issue lists, roadmaps, or anything "
            "with status dropdowns."
        ),
    ),
    Template(
        name="data_report",
        filename="data_report.py",
        description=(
            "Data report: Cover, Data (column-header table with frozen panes, "
            "zebra shading, totals row, optional formula columns) and Summary "
            "(KPI tiles, charts/notes area). Choose for reports, sales or "
            "marketing dashboards, any tabular dataset with summary metrics."
        ),
    ),
]


def list_templates() -> list[dict]:
    return [
        {"name": t.name, "description": t.description}
        for t in TEMPLATES
    ]


def get_template(name: str) -> Template | None:
    for t in TEMPLATES:
        if t.name == name:
            return t
    return None


def read_template(name: str) -> str:
    if name == "library" or name == "xlsx_builder":
        return (settings.templates_dir / LIBRARY_FILENAME).read_text(encoding="utf-8")
    template = get_template(name)
    if not template:
        raise ValueError(f"Unknown template: {name}")
    if template.filename == "__blank__":
        return (
            "# No template source — use the xlsx_builder library directly.\n"
            "# Call read_template('library') to see the Palette, Fmt, StyleKit, "
            "and XLSXBuilder classes you can import from.\n"
        )
    path: Path = settings.templates_dir / template.filename
    return path.read_text(encoding="utf-8")


def library_path() -> Path:
    return settings.templates_dir / LIBRARY_FILENAME
