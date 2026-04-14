#!/usr/bin/env python3
"""Test runner for UI Forge tests with file output."""
import contextlib
import sys
from pathlib import Path

import pytest


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PYTHON_SOURCE_ROOT = REPO_ROOT / "sources" / "python"
UI_TEST_ROOT = PYTHON_SOURCE_ROOT / "UI"
TEST_OUTPUT_PATH = SCRIPT_DIR / "test_results.txt"

sys.path.insert(0, str(PYTHON_SOURCE_ROOT))

with TEST_OUTPUT_PATH.open("w", encoding="utf-8") as output_file:
    with contextlib.redirect_stdout(output_file), contextlib.redirect_stderr(output_file):
        exit_code = pytest.main([
            "-v",
            "--tb=short",
            "--color=no",
            str(UI_TEST_ROOT / "test_models.py"),
            str(UI_TEST_ROOT / "test_base_generator.py"),
            str(UI_TEST_ROOT / "test_generator_manager.py"),
            str(UI_TEST_ROOT / "test_template_manager.py"),
            str(UI_TEST_ROOT / "test_example_templates.py"),
        ])

print(f"Tests completed with exit code: {exit_code}")
print(f"Results written to {TEST_OUTPUT_PATH}")
sys.exit(exit_code)
