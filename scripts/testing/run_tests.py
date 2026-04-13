#!/usr/bin/env python3
"""Test runner for UI Forge tests"""
import sys
import os

# Add sources/python to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sources/python'))

import pytest

# Run tests with verbose output
exit_code = pytest.main([
    '-v',
    '--tb=short',
    'sources/python/UI/test_models.py',
    'sources/python/UI/test_base_generator.py', 
    'sources/python/UI/test_generator_manager.py',
    'sources/python/UI/test_template_manager.py',
    'sources/python/UI/test_example_templates.py'
])

sys.exit(exit_code)
