"""Tests for the template registry."""

import pytest

from app.services.template_registry import (
    TEMPLATES,
    get_template,
    library_path,
    list_templates,
    read_template,
)


def test_list_templates_returns_all_entries():
    result = list_templates()
    names = [t["name"] for t in result]
    assert "blank" in names
    assert "financial_model" in names
    assert "invoice" in names
    assert "project_tracker" in names
    assert "data_report" in names
    assert len(result) == len(TEMPLATES)


def test_list_templates_includes_descriptions():
    for t in list_templates():
        assert "description" in t
        assert len(t["description"]) > 20  # non-trivial descriptions


def test_get_template_known_name():
    t = get_template("financial_model")
    assert t is not None
    assert t.filename == "financial_model.py"


def test_get_template_unknown_name():
    assert get_template("nonexistent") is None


def test_read_template_financial_model_has_expected_imports():
    src = read_template("financial_model")
    assert "from xlsx_builder import" in src
    assert "XLSXBuilder" in src


def test_read_template_blank_returns_pointer_message():
    src = read_template("blank")
    assert "library" in src.lower()
    assert "xlsx_builder" in src.lower()


def test_read_template_library_alias_returns_library_source():
    src = read_template("library")
    assert "class Palette" in src
    assert "class Fmt" in src
    assert "class StyleKit" in src
    assert "class XLSXBuilder" in src


def test_read_template_unknown_raises():
    with pytest.raises(ValueError, match="Unknown template"):
        read_template("nonexistent")


def test_library_path_exists_on_disk():
    p = library_path()
    assert p.exists()
    assert p.name == "xlsx_builder.py"
