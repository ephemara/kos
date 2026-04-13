"""
DocGen Main Entry Point

This module provides the main CLI entry point for the DocGen system.
It routes commands to the appropriate scripts and handles executable deployment.
Supports both FULL and LITE modes (LITE mode disables ML/embedding features).

Usage:
    docgen generate --path crates/
    docgen update-index  (FULL mode only)
    docgen index-stats   (FULL mode only)
    docgen mcp-server

Requirements: 15.2
"""

import sys
import asyncio
import os
from pathlib import Path

# Handle both development and executable contexts
if getattr(sys, 'frozen', False):
    # Running as PyInstaller executable
    application_path = Path(sys.executable).parent
    sys.path.insert(0, str(application_path))
else:
    # Running as Python script
    sys.path.insert(0, str(Path(__file__).parent))

# Detect if we're in LITE mode (no ML dependencies)
LITE_MODE = False
try:
    import torch
    import sentence_transformers
    import lancedb
except ImportError:
    LITE_MODE = True
    print("[INFO] Running in LITE mode (ML features disabled)")

# Load environment variables
try:
    from dotenv import load_dotenv
    # Try to load from executable directory first
    if getattr(sys, 'frozen', False):
        env_file = Path(sys.executable).parent / '.env.local'
    else:
        env_file = Path(__file__).parent / '.env.local'
    
    if env_file.exists():
        load_dotenv(env_file)
except ImportError:
    pass  # dotenv not available, skip


def print_usage():
    """Print usage information."""
    print("DocGen - Automated README Generation System")
    if LITE_MODE:
        print("(LITE MODE - Semantic search disabled)")
    print()
    print("Usage: docgen <command> [options]")
    print()
    print("Commands:")
    print("  generate       Generate README files for directories")
    if not LITE_MODE:
        print("  update-index   Update embedding index with changed files")
        print("  index-stats    Show index health and statistics")
        print("  mcp-server     Run MCP server for Kiro integration")
    print()
    print("Examples:")
    print("  docgen generate --path ./my-project")
    print("  docgen generate --dry-run")
    if not LITE_MODE:
        print("  docgen update-index --full-reindex")
        print("  docgen index-stats")
    print()
    print("For command-specific help:")
    print("  docgen <command> --help")


def main():
    """Main entry point for DocGen CLI."""
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Check if command requires FULL mode
    if LITE_MODE and command in ["update-index", "index-stats", "mcp-server"]:
        print(f"Error: '{command}' command requires FULL mode with ML dependencies")
        print()
        print("This is a LITE build without PyTorch/LanceDB/embeddings.")
        print("To use this command, install the full version or use:")
        print("  pip install torch sentence-transformers lancedb")
        sys.exit(1)
    
    # Remove command from args so scripts see clean argv
    sys.argv = [sys.argv[0]] + sys.argv[2:]
    
    try:
        if command == "generate":
            from scripts import generate
            generate.main()
        
        elif command == "update-index":
            from scripts import update_index
            update_index.main()
        
        elif command == "index-stats":
            from scripts import index_stats
            index_stats.main()
        
        elif command == "mcp-server":
            from scripts import mcp_server
            asyncio.run(mcp_server.main())
        
        elif command in ["--help", "-h", "help"]:
            print_usage()
            sys.exit(0)
        
        else:
            print(f"Error: Unknown command '{command}'")
            print()
            print_usage()
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(130)
    
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
