# Implementation Plan: Automated README Generation System

## Overview

This plan implements a Python-based documentation generation system with GPU-accelerated semantic search. The system consists of four main CLI scripts (generate.py, update_index.py, index_stats.py, mcp_server.py) and supporting modules for sandboxed file access, LLM integration, embedding generation, and vector database management.

Implementation follows K_OS principles: data-driven configuration, library-first approach (LanceDB, ONNX Runtime, sentence-transformers), and GPU-first performance (CUDA acceleration).

## Tasks

- [x] 1. Set up project structure and configuration
  - Create directory structure: src-python/DocGen/{core/, scripts/, .cache/, .lancedb/}
  - Create docgen_config.json with LLM, embedding, indexing, and performance settings
  - Create requirements.txt with dependencies: lancedb, onnxruntime-gpu, sentence-transformers, aiohttp, watchdog
  - Create .env.local template for API keys
  - _Requirements: 15.1, 15.3_

- [x] 2. Implement Sandboxed File Access Layer
  - [x] 2.1 Create core/file_access.py with SandboxedFileAccess class
    - Implement read_file() with path validation and security checks
    - Implement write_file() with .md extension enforcement
    - Implement list_directory() with recursive option
    - Implement file_exists() helper
    - Use pathlib.Path.resolve() to prevent path traversal
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 2.2 Write unit tests for file access security
    - Test path traversal prevention
    - Test write restriction to .md files only
    - Test read access to all file types
    - _Requirements: 13.3, 13.4_

- [x] 3. Implement LLM API Client
  - [x] 3.1 Create core/llm_client.py with LLMClient class
    - Implement OpenRouter API integration with aiohttp
    - Implement Gemini API integration
    - Implement exponential backoff for rate limiting (1s, 2s, 4s, 8s, 16s)
    - Implement cost estimation based on token usage
    - Load API keys from environment variables
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
  
  - [x] 3.2 Create LLMResponse dataclass
    - Fields: content, prompt_tokens, completion_tokens, model, cost_usd
    - _Requirements: 14.7_
  
  - [ ]* 3.3 Write unit tests for LLM client
    - Test rate limiting and retry logic
    - Test cost calculation
    - Mock API responses for testing
    - _Requirements: 14.6, 14.7_

- [x] 4. Implement Embedding Engine with GPU Acceleration
  - [x] 4.1 Create core/embedding_engine.py with EmbeddingEngine class
    - Initialize ONNX Runtime with CUDAExecutionProvider
    - Implement fallback to CPUExecutionProvider if CUDA unavailable
    - Load sentence-transformers model (all-MiniLM-L6-v2)
    - Implement embed_texts() with batching (batch_size=32)
    - Implement embed_single() for single text
    - Use FP16 precision for GPU inference
    - Implement mean pooling and normalization
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.7_
  
  - [x] 4.2 Implement GPU resource management
    - Implement get_device_info() to detect CUDA availability
    - Implement release_gpu() to free GPU memory
    - Log GPU utilization and embedding speed
    - _Requirements: 22.5, 22.7, 31.4_
  
  - [ ]* 4.3 Write performance tests for embedding engine
    - Benchmark GPU vs CPU embedding speed
    - Test batch processing efficiency
    - Verify 10x speedup on CUDA
    - _Requirements: 22.6_

- [x] 5. Implement LanceDB Interface
  - [x] 5.1 Create core/lance_db.py with LanceDBManager class
    - Initialize LanceDB connection to .lancedb/ directory
    - Define CodeEmbedding schema with LanceModel
    - Implement upsert_embeddings() with file_path as key
    - Implement search_similar() with cosine similarity
    - Implement get_by_path() for single file lookup
    - Implement delete_by_path() for deleted files
    - Implement get_stats() for database statistics
    - _Requirements: 21.1, 21.3, 21.7_
  
  - [x] 5.2 Create SearchResult dataclass
    - Fields: file_path, similarity_score, content_hash, module_name, metadata
    - _Requirements: 21.4, 21.5_
  
  - [ ]* 5.3 Write integration tests for LanceDB
    - Test upsert and search operations
    - Test similarity ranking
    - Test metadata filtering
    - _Requirements: 21.4, 21.5_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Change Detection System
  - [x] 7.1 Create core/change_detector.py with ChangeDetector class
    - Implement scan_directory() to detect file changes
    - Implement compute_file_hash() using SHA-256
    - Implement classify_change() to categorize changes (structural, behavioral, cosmetic)
    - Implement update_cache() to store hashes and timestamps
    - Load/save cache from .cache/analysis_cache.json
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_
  
  - [x] 7.2 Create ChangeReport and ChangeType dataclasses
    - ChangeReport: added_files, modified_files, deleted_files, unchanged_files, change_classifications
    - ChangeType enum: STRUCTURAL, BEHAVIORAL, COSMETIC
    - _Requirements: 23.4_
  
  - [ ]* 7.3 Write unit tests for change detection
    - Test hash computation
    - Test change classification logic
    - Test cache invalidation
    - _Requirements: 23.1, 23.2, 23.4_

- [x] 8. Implement README Generator
  - [x] 8.1 Create core/readme_generator.py with READMEGenerator class
    - Implement generate_readme() to orchestrate README generation
    - Implement build_system_prompt() with K_OS conventions and staleness disclaimer
    - Implement build_user_prompt() with directory-specific context
    - Implement extract_manual_sections() to preserve manual content
    - Implement merge_content() to combine generated and manual sections
    - Query LanceDB for related modules (top 5 by similarity)
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 8.2, 8.3, 16.1, 16.2, 16.3, 16.4, 28.1, 28.2, 28.3_
  
  - [x] 8.2 Create DirectoryContext dataclass
    - Fields: dir_path, file_tree, cargo_toml, package_json, key_files, related_modules, directory_type
    - _Requirements: 4.1, 5.1, 6.1, 16.5, 16.6, 16.7_
  
  - [x] 8.3 Implement directory type detection
    - Detect Rust crates (Cargo.toml present)
    - Detect React apps (K*.tsx files)
    - Detect Tauri backend (command handlers)
    - Detect special cases (ui/, engine/, test directories, GPU shaders)
    - _Requirements: 4.1, 5.1, 6.1, 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 8.4 Write unit tests for README generator
    - Test system prompt generation
    - Test manual section preservation
    - Test directory type detection
    - _Requirements: 8.2, 8.3, 16.1_

- [x] 9. Implement Repository Map Generator
  - [x] 9.1 Create core/repo_map_generator.py with RepoMapGenerator class
    - Implement generate_full_map() to create complete REPO_MAP.md
    - Implement update_incremental() for incremental updates
    - Implement build_directory_tree() for hierarchical structure
    - Implement build_semantic_clusters() using LanceDB similarity
    - Implement identify_entry_points() to find main apps and APIs
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 34.1_
  
  - [ ]* 9.2 Write unit tests for repository map generator
    - Test directory tree generation
    - Test semantic clustering
    - Test entry point detection
    - _Requirements: 33.2, 33.4, 33.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement generate.py CLI Script
  - [x] 11.1 Create scripts/generate.py with main() function
    - Parse CLI arguments: --path, --provider, --model, --dry-run, --review-mode, --watch, --force, --concurrency, --max-cost
    - Initialize SandboxedFileAccess, LLMClient, LanceDBManager, ChangeDetector, READMEGenerator
    - Implement directory traversal for target directories (crates/, src-frontend/, src-tauri/)
    - Skip empty directories and directories without code files
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7, 9.8, 15.2, 15.4_
  
  - [x] 11.2 Implement parallel directory processing
    - Use asyncio for concurrent LLM API requests
    - Respect --concurrency flag (default 3-5)
    - Implement rate limiting to respect API limits
    - Aggregate results and report progress
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  
  - [x] 11.3 Implement change detection integration
    - Use ChangeDetector to identify modified directories
    - Skip directories with only cosmetic changes
    - Regenerate READMEs for structural/behavioral changes
    - _Requirements: 18.1, 18.2, 18.3, 23.5, 23.6_
  
  - [x] 11.4 Implement cost tracking and budget limits
    - Track token usage and costs per request
    - Display estimated cost before starting
    - Stop processing when --max-cost limit reached
    - Log costs to cost_log.json
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  
  - [x] 11.5 Implement review mode
    - Display generated README content before writing
    - Prompt for approval (approve/reject/edit)
    - Skip writing if rejected
    - Allow inline edits before writing
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_
  
  - [x] 11.6 Implement watch mode
    - Use watchdog library to monitor file changes
    - Debounce rapid changes (2 second delay)
    - Trigger incremental regeneration on file save
    - Log each regeneration with timestamp
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_
  
  - [x] 11.7 Implement progress logging and final report
    - Log directory processing status to stdout
    - Report count of created, updated, skipped files
    - Report total API cost
    - _Requirements: 9.5, 9.6, 15.7_
  
  - [ ]* 11.8 Write integration tests for generate.py
    - Test dry-run mode
    - Test directory filtering
    - Test cost limit enforcement
    - _Requirements: 9.4, 19.4_

- [x] 12. Implement update_index.py CLI Script
  - [x] 12.1 Create scripts/update_index.py with main() function
    - Parse CLI arguments: --full-reindex, --path
    - Initialize SandboxedFileAccess, EmbeddingEngine, LanceDBManager, ChangeDetector
    - Scan target directories for file changes
    - Detect changes using timestamps and content hashes
    - _Requirements: 31.2, 32.1, 32.2, 32.7_
  
  - [x] 12.2 Implement batch embedding generation
    - Batch changed files for GPU processing
    - Call EmbeddingEngine.embed_texts() with batches
    - Upsert embeddings to LanceDB
    - _Requirements: 22.3, 27.2, 27.3, 32.3_
  
  - [x] 12.3 Implement GPU resource management
    - Load ONNX Runtime only when indexing
    - Release GPU memory after completion
    - Log GPU memory usage and release confirmation
    - _Requirements: 31.3, 31.4, 31.7_
  
  - [x] 12.4 Implement performance logging
    - Log files scanned, files changed, embeddings generated
    - Log GPU time and total time
    - Verify < 10 seconds for 5-10 file changes
    - _Requirements: 32.4, 32.6_
  
  - [x] 12.5 Implement full reindex mode
    - Support --full-reindex flag to re-embed all files
    - Handle embedding model version changes
    - _Requirements: 27.5, 27.6, 32.5_
  
  - [x] 12.6 Trigger repository map update
    - Call RepoMapGenerator.update_incremental() after indexing
    - Update REPO_MAP.md with new semantic connections
    - _Requirements: 33.7_
  
  - [ ]* 12.7 Write integration tests for update_index.py
    - Test incremental updates
    - Test full reindex
    - Test GPU memory release
    - _Requirements: 27.7, 31.4_

- [x] 13. Implement index_stats.py CLI Script
  - [x] 13.1 Create scripts/index_stats.py with main() function
    - Query LanceDB for total embeddings and index size
    - Detect stale files (modified but not re-indexed)
    - Calculate semantic coverage (% of codebase indexed)
    - Format output as terminal table
    - Support --json flag for programmatic access
    - _Requirements: 31.2_
  
  - [ ]* 13.2 Write unit tests for index_stats.py
    - Test staleness detection
    - Test coverage calculation
    - _Requirements: 31.2_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement MCP Server
  - [x] 15.1 Create scripts/mcp_server.py with MCP protocol implementation
    - Use mcp Python package for JSON-RPC 2.0 over stdio
    - Implement server initialization and tool registration
    - Implement error handling and logging to mcp_server.log
    - _Requirements: 24.1, 24.3, 24.4, 24.5, 24.7_
  
  - [x] 15.2 Implement generate_readme tool
    - Accept directory path parameter
    - Call READMEGenerator.generate_readme()
    - Return generated README content
    - _Requirements: 24.2_
  
  - [x] 15.3 Implement query_docs tool
    - Accept query string, max_results, filter_path parameters
    - Embed query using EmbeddingEngine (CPU-only)
    - Search LanceDB for similar code chunks
    - Pass chunks to LLM for RAG synthesis
    - Return synthesized response with citations
    - _Requirements: 24.2, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 31.5_
  
  - [x] 15.4 Implement search_code tool
    - Accept query string and filter parameters
    - Perform vector search on LanceDB
    - Return top-k results with similarity scores
    - _Requirements: 24.2_
  
  - [x] 15.5 Implement get_quality_metrics tool
    - Query metrics_history.json for quality scores
    - Return metrics for specified directory or all directories
    - _Requirements: 24.2, 29.7_
  
  - [x] 15.6 Implement get_index_stats tool
    - Call LanceDBManager.get_stats()
    - Return index statistics
    - _Requirements: 24.2_
  
  - [x] 15.7 Ensure MCP server is lightweight and CPU-only
    - No GPU usage in MCP server
    - Query pre-computed embeddings only
    - Cache LLM responses (5 min TTL)
    - _Requirements: 31.5, 31.6_
  
  - [ ]* 15.8 Write integration tests for MCP server
    - Test tool invocations
    - Test JSON-RPC protocol compliance
    - Test error handling
    - _Requirements: 24.5, 24.7_

- [x] 16. Implement Quality Metrics System
  - [x] 16.1 Create core/quality_metrics.py with QualityMetrics class
    - Implement compute_metrics() for README quality scoring
    - Calculate completeness score (sections present)
    - Calculate clarity score (readability metrics)
    - Calculate example coverage (code examples present)
    - Calculate cross-reference density (related modules count)
    - Compute overall score as weighted average
    - _Requirements: 29.1, 29.2_
  
  - [x] 16.2 Implement quality reporting
    - Flag READMEs with scores < 70%
    - Generate quality report as markdown table
    - Track quality trends in metrics_history.json
    - _Requirements: 29.3, 29.4, 29.5, 29.6_
  
  - [ ]* 16.3 Write unit tests for quality metrics
    - Test score calculation
    - Test flagging logic
    - _Requirements: 29.2, 29.3_

- [x] 17. Implement Cross-Reference Detection
  - [x] 17.1 Enhance READMEGenerator with cross-reference detection
    - Use LanceDB semantic search to find related modules
    - Rank by similarity score (top 5)
    - Detect import statements in code
    - Identify circular dependencies
    - Include relative file paths in cross-references
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7_
  
  - [ ]* 17.2 Write unit tests for cross-reference detection
    - Test import detection
    - Test circular dependency detection
    - _Requirements: 28.4, 28.6_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implement Standalone Executable Build
  - [x] 19.1 Create build_exe.bat build script
    - Use PyInstaller or Nuitka for executable generation
    - Bundle all dependencies (ONNX Runtime, CUDA libraries)
    - Configure output to dist/docgen.exe
    - Optimize for size (target < 500MB compressed)
    - _Requirements: 25.1, 25.2, 25.3, 25.5, 25.7_
  
  - [x] 19.2 Test executable functionality
    - Verify all CLI flags work in executable
    - Verify MCP server mode works
    - Test on Windows 10/11 without Python installed
    - _Requirements: 25.4, 25.6_
  
  - [ ]* 19.3 Write build verification tests
    - Test executable size
    - Test dependency bundling
    - _Requirements: 25.5_

- [x] 20. Implement Semantic Connection Discovery
  - [x] 20.1 Enhance RepoMapGenerator with semantic clustering
    - Compute pairwise similarity between all indexed files
    - Identify clusters with similarity > 0.70
    - Generate semantic connection graph
    - Include in REPO_MAP.md
    - _Requirements: 34.1_
  
  - [ ]* 20.2 Write unit tests for semantic clustering
    - Test similarity computation
    - Test cluster identification
    - _Requirements: 34.1_

- [x] 21. Integration and Final Wiring
  - [x] 21.1 Create main entry point __main__.py
    - Route to appropriate script based on command
    - Support: generate, update-index, index-stats, mcp-server
    - _Requirements: 15.2_
  
  - [x] 21.2 Create comprehensive README.md for DocGen system
    - Document installation and setup
    - Document CLI usage for all scripts
    - Document MCP server configuration for Kiro
    - Document configuration options in docgen_config.json
    - Include examples for common workflows
    - _Requirements: 15.1_
  
  - [x] 21.3 Verify all requirements are met
    - Test full workflow: index → generate → query
    - Test all CLI flags and modes
    - Test MCP server integration with Kiro
    - Verify GPU acceleration performance
    - Verify cost tracking and limits
    - _Requirements: All_

- [x] 22. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Implementation uses Python 3.11+ with type hints
- GPU acceleration is critical for performance (CUDA on Quadro RTX 4000)
- MCP server must remain lightweight and CPU-only
- All file writes are sandboxed to .md files only for security
