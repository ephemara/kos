#!/usr/bin/env python3
"""Test runner for UI Forge tests."""
import sys
<<<<<<< Updated upstream
import os

# Add src-python to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src-python'))
||||||| Stash base
import os

# Add sources/python to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sources/python'))
=======
from pathlib import Path
>>>>>>> Stashed changes

import pytest


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PYTHON_SOURCE_ROOT = REPO_ROOT / "sources" / "python"
UI_TEST_ROOT = PYTHON_SOURCE_ROOT / "UI"

sys.path.insert(0, str(PYTHON_SOURCE_ROOT))

exit_code = pytest.main([
<<<<<<< Updated upstream
    '-v',
    '--tb=short',
    'src-python/UI/test_models.py',
    'src-python/UI/test_base_generator.py', 
    'src-python/UI/test_generator_manager.py',
    'src-python/UI/test_template_manager.py',
    'src-python/UI/test_example_templates.py'
||||||| Stash base
    '-v',
    '--tb=short',
    'sources/python/UI/test_models.py',
    'sources/python/UI/test_base_generator.py', 
    'sources/python/UI/test_generator_manager.py',
    'sources/python/UI/test_template_manager.py',
    'sources/python/UI/test_example_templates.py'
=======
    "-v",
    "--tb=short",
    str(UI_TEST_ROOT / "test_models.py"),
    str(UI_TEST_ROOT / "test_base_generator.py"),
    str(UI_TEST_ROOT / "test_generator_manager.py"),
    str(UI_TEST_ROOT / "test_template_manager.py"),
    str(UI_TEST_ROOT / "test_example_templates.py"),
>>>>>>> Stashed changes
])

sys.exit(exit_code)
