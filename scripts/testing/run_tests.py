#!/usr/bin/env python3
"""Test runner for UI Forge tests."""
import sys
from pathlib import Path

import pytest


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PYTHON_SOURCE_ROOT = REPO_ROOT / "sources" / "python"
UI_TEST_ROOT = PYTHON_SOURCE_ROOT / "UI"

sys.path.insert(0, str(PYTHON_SOURCE_ROOT))

exit_code = pytest.main([
    "-v",
    "--tb=short",
    str(UI_TEST_ROOT / "test_models.py"),
    str(UI_TEST_ROOT / "test_base_generator.py"),
    str(UI_TEST_ROOT / "test_generator_manager.py"),
    str(UI_TEST_ROOT / "test_template_manager.py"),
    str(UI_TEST_ROOT / "test_example_templates.py"),
])

sys.exit(exit_code)
