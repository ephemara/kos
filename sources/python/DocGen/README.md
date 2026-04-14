# DocGen - Automated README Generation System

*AI-powered documentation generator for the K_OS DCC Suite*

## Overview

DocGen is a Python-based documentation system that automatically generates and maintains README.md files throughout the K_OS codebase. It combines LLM-powered code analysis with GPU-accelerated semantic search to produce high-quality, architecturally-focused documentation.

**Key Features:**
- 🤖 LLM-powered README generation (OpenRouter/Gemini)
- 🚀 GPU-accelerated embedding generation (CUDA on RTX 4000)
- 🔍 Semantic code search with LanceDB vector database
- 📊 Quality metrics and documentation health monitoring
- 🔄 Incremental updates with change detection
- 🔌 MCP server for Kiro IDE integration
- 📦 Standalone executable distribution

## Architecture

DocGen consists of four main components:

1. **Documentation Generator** (`generate.py`) - LLM-powered README generation
2. **Index Manager** (`update_index.py`) - GPU-accelerated embedding generation
3. **Index Statistics** (`index_stats.py`) - Health monitoring and staleness detection
4. **MCP Server** (`mcp_server.py`) - Kiro integration for interactive queries

## Installation

### Prerequisites

- Python 3.11+
- CUDA-capable GPU (optional, for GPU acceleration)
- OpenRouter or Gemini API key

### Setup

1. **Install dependencies:**
   ```bash
   cd sources/python/DocGen
   pip install -r requirements.txt
   ```

2. **Configure API keys:**
   Create a `.env.local` file in the DocGen directory:
   ```bash
   OPENROUTER_API_KEY=your_key_here
   # OR
   GEMINI_API_KEY=your_key_here
   ```

3. **Configure settings:**
   Edit `docgen_config.json` to customize:
   - LLM provider and model
   - Embedding model
   - Target directories
   - Cost limits
   - Performance settings

## Usage

### Command Line Interface

DocGen provides four main commands:

#### 1. Generate READMEs

Generate README files for directories:

```bash
# Generate for all target directories
python -m DocGen generate

# Generate for specific directory
python -m DocGen generate --path crates/k-os-engine

# Dry run (no LLM calls, no file writes)
python -m DocGen generate --dry-run

# Force regeneration (ignore change detection)
python -m DocGen generate --force

# Review mode (approve each README before writing)
python -m DocGen generate --review-mode

# Watch mode (auto-regenerate on file changes)
python -m DocGen generate --watch

# Custom LLM settings
python -m DocGen generate --provider openrouter --model anthropic/claude-3.5-sonnet

# Cost limit
python -m DocGen generate --max-cost 5.0
```

**Options:**
- `--path PATH` - Target directory (default: all target directories)
- `--provider PROVIDER` - LLM provider (openrouter, gemini)
- `--model MODEL` - LLM model name
- `--dry-run` - Show what would be generated without API calls
- `--force` - Force regeneration even if no changes detected
- `--review-mode` - Interactively approve each README
- `--watch` - Watch for file changes and auto-regenerate
- `--concurrency N` - Number of concurrent LLM requests (default: 3)
- `--max-cost USD` - Maximum cost limit in USD

#### 2. Update Index

Update the embedding index with changed files:

```bash
# Incremental update (only changed files)
python -m DocGen update-index

# Full reindex (all files)
python -m DocGen update-index --full-reindex

# Specific directory
python -m DocGen update-index --path crates/
```

**Options:**
- `--full-reindex` - Re-embed all files (ignores cache)
- `--path PATH` - Target directory (default: all target directories)

**Performance:**
- GPU-accelerated: ~10 seconds for 5-10 files
- CPU fallback: ~60 seconds for 5-10 files

#### 3. Index Statistics

View index health and staleness information:

```bash
# Show statistics
python -m DocGen index-stats

# JSON output
python -m DocGen index-stats --json
```

**Output:**
- Total embeddings count
- Index size on disk
- Stale files (modified but not re-indexed)
- Semantic coverage percentage
- Last update timestamp

#### 4. MCP Server

Run the MCP server for Kiro integration:

```bash
python -m DocGen mcp-server
```

The MCP server exposes tools for:
- `generate_readme` - Generate README for a directory
- `query_docs` - Semantic search + RAG synthesis
- `search_code` - Vector similarity search
- `get_quality_metrics` - Documentation quality scores
- `get_index_stats` - Index health information

**Kiro Configuration:**

Add to your `mcp.json`:
```json
{
  "mcpServers": {
    "docgen": {
      "command": "python",
      "args": ["-m", "DocGen", "mcp-server"],
      "cwd": "M:/K_OS/sources/python/DocGen"
    }
  }
}
```

## Configuration

### docgen_config.json

```json
{
  "llm": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "api_key_env": "OPENROUTER_API_KEY",
    "max_tokens": 4000,
    "temperature": 0.3
  },
  "embedding": {
    "model": "sentence-transformers/all-MiniLM-L6-v2",
    "use_gpu": true,
    "batch_size": 32,
    "precision": "fp16"
  },
  "indexing": {
    "target_directories": ["crates", "apps", "sources"],
    "excluded_patterns": ["**/node_modules/**", "**/target/**"],
    "file_extensions": [".rs", ".ts", ".tsx", ".py", ".wgsl"]
  },
  "costs": {
    "max_cost_per_run_usd": 5.0
  }
}
```

## Workflow

### Typical Workflow

1. **Initial Setup:**
   ```bash
   # Generate embeddings for entire codebase
   python -m DocGen update-index --full-reindex
   
   # Generate all READMEs
   python -m DocGen generate
   ```

2. **After Code Changes:**
   ```bash
   # Update index with changed files
   python -m DocGen update-index
   
   # Regenerate affected READMEs
   python -m DocGen generate
   ```

3. **Check Documentation Quality:**
   ```bash
   # View quality metrics
   python -m DocGen index-stats
   
   # Generate quality report
   python scripts/generate.py --report
   ```

### Development Workflow

For active development, use watch mode:

```bash
# Terminal 1: Watch for changes and auto-regenerate
python -m DocGen generate --watch

# Terminal 2: Update index as needed
python -m DocGen update-index
```

## Features

### Sandboxed File Access

The AI agent has:
- ✅ **Read access** to all files in the codebase
- ✅ **Write access** ONLY to `.md` files
- ❌ **No access** to modify source code

This ensures safe autonomous operation.

### Change Detection

DocGen intelligently detects changes:
- **Structural changes** (new functions, classes) → Regenerate README
- **Behavioral changes** (logic updates) → Regenerate README
- **Cosmetic changes** (comments, formatting) → Skip regeneration

### Quality Metrics

Documentation quality is scored on:
- **Completeness** (required sections present)
- **Clarity** (readability metrics)
- **Example Coverage** (code examples present)
- **Cross-Reference Density** (related modules linked)

READMEs with scores < 70% are flagged for review.

### Semantic Search

LanceDB vector database enables:
- Finding semantically similar modules
- Discovering implicit relationships
- Identifying related functionality
- Cross-referencing dependencies

### Cost Tracking

All LLM API costs are tracked:
- Per-request token usage
- Cumulative costs
- Cost limits and warnings
- Detailed cost logs

## Project Structure

```
DocGen/
├── core/                      # Core modules
│   ├── file_access.py         # Sandboxed file access
│   ├── llm_client.py          # LLM API client
│   ├── embedding_engine.py    # GPU-accelerated embeddings
│   ├── lance_db.py            # Vector database
│   ├── change_detector.py     # Change detection
│   ├── readme_generator.py    # README generation
│   ├── repo_map_generator.py  # Repository map
│   ├── quality_metrics.py     # Quality scoring
│   └── cost_tracker.py        # Cost tracking
│
├── scripts/                   # CLI scripts
│   ├── generate.py            # README generation
│   ├── update_index.py        # Index management
│   ├── index_stats.py         # Statistics
│   └── mcp_server.py          # MCP server
│
├── __main__.py                # Main entry point
├── docgen_config.json         # Configuration
├── requirements.txt           # Dependencies
├── build_exe.bat              # Executable builder
└── README.md                  # This file
```

## Advanced Usage

### Custom Prompts

Modify system prompts in `core/readme_generator.py`:
- `build_system_prompt()` - System-level instructions
- `build_user_prompt()` - Directory-specific context

### Custom Quality Metrics

Add custom metrics in `core/quality_metrics.py`:
- Extend `QualityMetricsCalculator` class
- Add new scoring methods
- Update weights in `DEFAULT_WEIGHTS`

### Custom Clustering

Modify semantic clustering in `core/repo_map_generator.py`:
- Adjust `similarity_threshold` (default: 0.70)
- Implement custom clustering algorithms
- Add domain-specific grouping logic

## Troubleshooting

### GPU Not Detected

If CUDA is not detected:
```bash
# Check CUDA availability
python -c "import torch; print(torch.cuda.is_available())"

# Install CUDA-enabled PyTorch
pip install torch --index-url https://download.pytorch.org/whl/cu118
```

### LLM API Errors

If API calls fail:
1. Check API key in `.env.local`
2. Verify API key has sufficient credits
3. Check rate limits (reduce `--concurrency`)
4. Try different model with `--model`

### Index Corruption

If LanceDB index is corrupted:
```bash
# Delete index and rebuild
rm -rf .lancedb/
python -m DocGen update-index --full-reindex
```

### Out of Memory

If GPU runs out of memory:
1. Reduce `batch_size` in `docgen_config.json`
2. Use CPU mode: `"use_gpu": false`
3. Process fewer files at once

## Performance

### Benchmarks (RTX 4000, 8GB VRAM)

- **Embedding Generation:**
  - GPU: ~100 files/second (FP16)
  - CPU: ~10 files/second
  
- **README Generation:**
  - ~30 seconds per README (LLM-dependent)
  - ~3-5 concurrent requests optimal
  
- **Index Query:**
  - ~10ms per semantic search
  - ~50ms for top-10 results

### Optimization Tips

1. **Use GPU acceleration** for embedding generation
2. **Batch process** multiple directories
3. **Enable caching** to skip unchanged files
4. **Adjust concurrency** based on API rate limits
5. **Use dry-run** to preview before expensive operations

## Contributing

### Adding New Features

1. Create module in `core/`
2. Add CLI command in `scripts/`
3. Update `__main__.py` routing
4. Add tests in `test_*.py`
5. Update this README

### Code Style

- Follow PEP 8
- Use type hints
- Add docstrings (Google style)
- Log important operations
- Handle errors gracefully

## License

Part of the K_OS DCC Suite project.

## Support

For issues or questions:
1. Check this README
2. Review `docgen_config.json` settings
3. Check logs in `mcp_server.log`
4. Review cost logs in `cost_log.json`

---

**Built with:** Python 3.11, LanceDB, ONNX Runtime, sentence-transformers, OpenRouter/Gemini
