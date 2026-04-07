#!/usr/bin/env python3
"""
DocGen CLI Wrapper

Simple executable wrapper that calls the DocGen module from anywhere.
Works with current working directory - just run 'python docgen.py <path>'.

Usage:
    python docgen.py generate --path ./my-project
    python docgen.py generate --path src-python/ui
    python docgen.py --help
"""

import sys
import os
from pathlib import Path

# Hardcoded path to DocGen module (this file's directory)
DOCGEN_DIR = Path(__file__).parent.absolute()

# Add DocGen to Python path
if str(DOCGEN_DIR) not in sys.path:
    sys.path.insert(0, str(DOCGEN_DIR))

# Change to the directory where the user invoked the command
# This makes relative paths work correctly
INVOKE_DIR = Path.cwd()

if __name__ == "__main__":
    # Import the DocGen __main__ module and run it
    import importlib.util
    
    main_path = DOCGEN_DIR / "__main__.py"
    spec = importlib.util.spec_from_file_location("docgen_main", main_path)
    docgen_main = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(docgen_main)
    
    # Run the main function
    docgen_main.main()
