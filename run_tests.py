#!/usr/bin/env python3
"""Test runner for UI Forge tests"""
import sys
import os

# Add src-python to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src-python'))

import pytest

# Run tests with verbose output
exit_code = pytest.main([
    '-v',
    '--tb=short',
    'src-python/UI/test_models.py',
    'src-python/UI/test_base_generator.py', 
    'src-python/UI/test_generator_manager.py',
    'src-python/UI/test_template_manager.py',
    'src-python/UI/test_example_templates.py'
])

sys.exit(exit_code)
