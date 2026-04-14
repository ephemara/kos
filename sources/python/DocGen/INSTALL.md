# DocGen Installation Guide

## Quick Start (Recommended)

Add `M:\K_OS\sources/python\DocGen` to your Windows PATH:

1. Press `Win + X` and select "System"
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "User variables", select "Path" and click "Edit"
5. Click "New" and add: `M:\K_OS\sources/python\DocGen`
6. Click "OK" on all dialogs
7. **Restart your terminal** (PowerShell/CMD)

Now you can use `docgen` from anywhere:

```bash
# From K_OS root
docgen generate --path ./test-docgen

# From any subdirectory
cd sources/python
docgen generate --path ./ui

# From anywhere on your system
cd C:\MyProjects\SomeApp
docgen generate --path ./src
```

## Usage

```bash
# Generate READMEs (dry run)
docgen generate --path ./my-project --dry-run

# Generate READMEs (actual generation)
docgen generate --path ./my-project

# Update embedding index
docgen update-index

# Show index statistics
docgen index-stats

# Run MCP server for Kiro integration
docgen mcp-server

# Show help
docgen --help
docgen generate --help
```

## Features

- **Workspace-aware**: Works with relative paths from your current directory
- **LLM-powered**: Uses OpenRouter API with free Qwen model
- **GPU-accelerated**: CUDA-enabled semantic search with sentence-transformers
- **Change detection**: Only regenerates READMEs for modified files
- **Cost tracking**: Monitors API usage and costs
- **Quality metrics**: Validates README completeness and quality

## Configuration

Edit `M:\K_OS\sources/python\DocGen\docgen_config.json` to customize:
- LLM provider and model
- File patterns to include/exclude
- README templates
- Quality thresholds

## Troubleshooting

**Command not found after adding to PATH:**
- Restart your terminal completely
- Verify PATH with: `echo $env:PATH` (PowerShell) or `echo %PATH%` (CMD)

**Python not found:**
- Ensure Python 3.11+ is installed and in PATH
- Test with: `python --version`

**Import errors:**
- Install dependencies: `pip install -r requirements.txt`
- From `M:\K_OS\sources/python\DocGen` directory
