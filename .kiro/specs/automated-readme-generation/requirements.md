# Requirements Document

## Introduction

The Automated README Generation System is an AI-powered documentation tool that generates and maintains README.md files throughout the K_OS DCC Suite codebase. The system uses LLM APIs (OpenRouter/Gemini) with sandboxed file access to analyze directory structures and code, producing general-purpose architectural documentation that serves as a baseline for AI agents and developers. The AI agent has read access to the entire codebase but write access restricted to markdown files only, ensuring safe autonomous operation.

## Glossary

- **AI_Documentation_Agent**: The LLM-powered agent that analyzes code and generates documentation
- **DocGen_System**: The Python orchestration system located in src-python/DocGen that manages AI agent execution
- **DocGen_MCP_Server**: The Model Context Protocol server that exposes documentation tools to Kiro
- **Target_Directory**: A directory under crates/, src-frontend/, or src-tauri/ that requires a README
- **Sandboxed_File_Access**: Security model where AI agent can read any file but only write .md files
- **LLM_Provider**: OpenRouter or Gemini API used for AI-powered analysis
- **LanceDB**: Vector database for semantic code search and embedding storage
- **ONNX_Runtime**: GPU-accelerated inference runtime for embedding generation (CUDA on Quadro RTX 4000)
- **Semantic_Embedding**: Vector representation of code/documentation for similarity search
- **Change_Detection**: System that identifies modified files and determines if documentation needs updating
- **Staleness_Disclaimer**: The required warning text that appears at the top of every generated README
- **Architectural_Summary**: A high-level description of a directory's purpose, systems, and patterns without file-by-file details
- **Quality_Metrics**: Computed scores for documentation completeness, clarity, and usefulness

## Requirements

### Requirement 1: Generate README Files in All Target Directories

**User Story:** As a developer or AI agent, I want README files in every subdirectory of crates/, src-frontend/, and src-tauri/, so that I can quickly understand the purpose and architecture of each module.

#### Acceptance Criteria

1. THE README_Generator SHALL create a README.md file in every subdirectory under m:\K_OS\crates
2. THE README_Generator SHALL create a README.md file in every subdirectory under m:\K_OS\src-frontend
3. THE README_Generator SHALL create a README.md file in every subdirectory under m:\K_OS\src-tauri
4. WHEN a Target_Directory contains no code files, THE README_Generator SHALL skip that directory
5. WHEN a Target_Directory already contains a README.md, THE README_Generator SHALL preserve any manually-added sections marked with a preservation tag

### Requirement 2: Include Staleness Disclaimer

**User Story:** As a user of generated documentation, I want a clear warning about potential staleness, so that I know to verify information against the actual code.

#### Acceptance Criteria

1. THE README_Generator SHALL insert the Staleness_Disclaimer at the top of every generated README
2. THE Staleness_Disclaimer SHALL read: "*This README may be out of date and inspecting the current code is the best way. NEVER ASSUME THIS README IS CURRENT ARCHITECTURE, BUT RATHER TREAT IT AS A BASELINE FOR what's in this folder*"
3. THE Staleness_Disclaimer SHALL appear before any other content in the README
4. THE Staleness_Disclaimer SHALL be formatted as italic text using markdown syntax

### Requirement 3: Generate Architectural Summaries

**User Story:** As a developer, I want high-level architectural descriptions rather than exhaustive file listings, so that the documentation remains maintainable and useful.

#### Acceptance Criteria

1. THE AI_Documentation_Agent SHALL identify the primary purpose of each Target_Directory
2. THE AI_Documentation_Agent SHALL detect architectural patterns (modules, pipelines, components, services)
3. THE AI_Documentation_Agent SHALL extract key abstractions and system boundaries
4. THE AI_Documentation_Agent SHALL NOT enumerate every file in the directory
5. THE AI_Documentation_Agent SHALL focus on system-level concepts and relationships
6. WHERE a Target_Directory contains GPU pipelines, THE AI_Documentation_Agent SHALL describe the pipeline architecture and data flow
7. WHERE a Target_Directory contains React components, THE AI_Documentation_Agent SHALL describe the component hierarchy and state management patterns

### Requirement 4: Analyze Rust Crate Structure

**User Story:** As a developer working with Rust crates, I want READMEs that explain module organization and public APIs, so that I understand how to use and extend the crate.

#### Acceptance Criteria

1. WHEN analyzing a Rust crate directory, THE AI_Documentation_Agent SHALL read Cargo.toml to extract crate metadata
2. THE AI_Documentation_Agent SHALL read lib.rs or main.rs to identify public modules
3. THE AI_Documentation_Agent SHALL detect feature flags and conditional compilation patterns
4. THE AI_Documentation_Agent SHALL document the crate's primary purpose and responsibilities
5. THE AI_Documentation_Agent SHALL list major public modules with brief descriptions
6. WHERE feature flags exist, THE AI_Documentation_Agent SHALL document optional functionality
7. THE AI_Documentation_Agent SHALL identify key dependencies and their purposes

### Requirement 5: Analyze Frontend Structure

**User Story:** As a frontend developer, I want READMEs that explain React app structure and component organization, so that I can navigate the codebase efficiently.

#### Acceptance Criteria

1. WHEN analyzing a frontend directory, THE Codebase_Analyzer SHALL identify React components by file naming conventions
2. THE Codebase_Analyzer SHALL detect app entry points (files starting with K*.tsx)
3. THE Codebase_Analyzer SHALL identify service clients and API integrations
4. THE README_Generator SHALL describe the app or component's user-facing purpose
5. THE README_Generator SHALL document major UI panels and their responsibilities
6. WHERE Tauri IPC is used, THE README_Generator SHALL note the backend integration points
7. THE README_Generator SHALL identify state management patterns (Zustand, Jotai, context)

### Requirement 6: Analyze Tauri Backend Structure

**User Story:** As a backend developer, I want READMEs that explain IPC command organization and module boundaries, so that I understand the backend architecture.

#### Acceptance Criteria

1. WHEN analyzing a Tauri backend directory, THE Codebase_Analyzer SHALL identify Tauri command handlers
2. THE Codebase_Analyzer SHALL detect module organization and command registration patterns
3. THE README_Generator SHALL document the module's role in the IPC layer
4. THE README_Generator SHALL list major command groups and their purposes
5. WHERE Python bridge integration exists, THE README_Generator SHALL document the sidecar communication pattern

### Requirement 7: Maintain Consistent Formatting

**User Story:** As a documentation consumer, I want consistent README structure across all directories, so that I can quickly find the information I need.

#### Acceptance Criteria

1. THE Template_Engine SHALL use a consistent markdown structure for all generated READMEs
2. THE README_Generator SHALL include these sections in order: Staleness_Disclaimer, Overview, Architecture, Key Components, Usage Patterns
3. THE Template_Engine SHALL use proper markdown heading hierarchy (h1 for title, h2 for sections, h3 for subsections)
4. THE README_Generator SHALL use code blocks with language tags for code examples
5. THE README_Generator SHALL use bullet lists for enumerations and feature lists

### Requirement 8: Support Incremental Updates

**User Story:** As a developer maintaining the codebase, I want the ability to regenerate READMEs without losing manual additions, so that documentation stays current without manual rework.

#### Acceptance Criteria

1. THE README_Generator SHALL detect existing README.md files before generation
2. WHERE a README contains a section marked with `<!-- MANUAL_CONTENT_START -->` and `<!-- MANUAL_CONTENT_END -->`, THE README_Generator SHALL preserve that content
3. THE README_Generator SHALL regenerate all auto-generated sections while preserving manual sections
4. THE README_Generator SHALL add a generation timestamp comment at the end of each README
5. WHEN invoked with a `--force` flag, THE README_Generator SHALL regenerate all content without preservation

### Requirement 9: Provide Generation Command Interface

**User Story:** As a developer, I want a simple command to generate or update all READMEs, so that I can keep documentation current with minimal effort.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide a Python CLI script `python src-python/DocGen/generate.py`
2. WHEN invoked without arguments, THE DocGen_System SHALL process all three target root directories (crates/, src-frontend/, src-tauri/)
3. WHERE a `--path` argument is provided, THE DocGen_System SHALL process only that directory and its subdirectories
4. WHERE a `--dry-run` flag is provided, THE DocGen_System SHALL show what would be generated without writing files or calling LLM APIs
5. THE DocGen_System SHALL log progress to stdout showing which directories are being processed and API call status
6. WHEN generation completes, THE DocGen_System SHALL report the count of created files, updated files, skipped files, and total API cost
7. THE DocGen_System SHALL support `--provider` flag to choose between openrouter and gemini
8. THE DocGen_System SHALL support `--model` flag to specify the LLM model (e.g., claude-3.5-sonnet)

### Requirement 10: Handle Special Directory Cases

**User Story:** As a system architect, I want the generator to handle edge cases appropriately, so that the tool works reliably across the entire codebase.

#### Acceptance Criteria

1. WHEN a Target_Directory contains only test files, THE README_Generator SHALL note this is a test directory and describe the testing scope
2. WHEN a Target_Directory contains GPU shader files (.wgsl), THE README_Generator SHALL document the shader pipeline and compute operations
3. WHEN a Target_Directory contains only configuration files, THE README_Generator SHALL describe the configuration schema and purpose
4. WHERE a Target_Directory is named `ui/`, THE README_Generator SHALL focus on component composition and UI patterns
5. WHERE a Target_Directory is named `engine/`, THE README_Generator SHALL focus on business logic and state management
6. IF a Target_Directory cannot be analyzed (permissions, corruption), THEN THE README_Generator SHALL log a warning and continue processing other directories

### Requirement 11: Integrate with Project Conventions

**User Story:** As a K_OS developer, I want generated READMEs to reference project-specific conventions and documentation, so that they serve as effective entry points to the codebase.

#### Acceptance Criteria

1. WHERE relevant, THE README_Generator SHALL reference CARGO_ARSENAL.md for Rust dependencies
2. WHERE relevant, THE README_Generator SHALL reference NPM_ARSENAL.md for frontend dependencies
3. WHERE relevant, THE README_Generator SHALL reference PYTHON_ARSENAL.md for Python dependencies
4. THE README_Generator SHALL note adherence to data-driven, library-first, and GPU-first principles where applicable
5. WHERE GPU compute is used, THE README_Generator SHALL mention wgpu and reference the gpu/ module structure
6. WHERE Three.js is used, THE README_Generator SHALL mention @react-three/fiber integration patterns

### Requirement 12: Parse and Format Code Examples

**User Story:** As a developer learning the codebase, I want minimal code examples in READMEs that show typical usage patterns, so that I can quickly understand how to work with the module.

#### Acceptance Criteria

1. WHERE appropriate, THE README_Generator SHALL include a minimal usage example
2. THE README_Generator SHALL extract example code from doc comments or example files when available
3. THE README_Generator SHALL format code examples with proper syntax highlighting
4. THE README_Generator SHALL limit examples to 10-15 lines maximum
5. IF no suitable example exists, THEN THE README_Generator SHALL omit the example section rather than generate placeholder code

### Requirement 13: AI Agent Sandboxed File Access

**User Story:** As a system administrator, I want the AI agent to have restricted file access, so that autonomous documentation generation is safe and cannot modify source code.

#### Acceptance Criteria

1. THE AI_Documentation_Agent SHALL have read access to all files in the K_OS codebase
2. THE AI_Documentation_Agent SHALL have write access ONLY to files with .md extension
3. THE DocGen_System SHALL enforce file access restrictions at the runtime level
4. WHEN the AI agent attempts to write a non-markdown file, THE DocGen_System SHALL reject the operation and log a warning
5. THE AI_Documentation_Agent SHALL be able to read Cargo.toml, package.json, tsconfig.json, and all source files
6. THE AI_Documentation_Agent SHALL be able to write README.md and analysis markdown files only

### Requirement 14: LLM API Integration

**User Story:** As a developer, I want the system to use powerful LLM APIs for intelligent code analysis, so that generated documentation is high-quality and contextually aware.

#### Acceptance Criteria

1. THE DocGen_System SHALL support OpenRouter API integration
2. THE DocGen_System SHALL support Google Gemini API integration
3. THE DocGen_System SHALL load API keys from environment variables or .env.local
4. WHERE OpenRouter is configured, THE DocGen_System SHALL use the specified model (e.g., claude-3.5-sonnet, gpt-4)
5. WHERE Gemini is configured, THE DocGen_System SHALL use the Gemini API endpoint
6. THE DocGen_System SHALL handle API rate limits gracefully with exponential backoff
7. THE DocGen_System SHALL log API usage and token consumption for cost tracking

### Requirement 15: Python Orchestration System

**User Story:** As a developer, I want a Python-based orchestration system in src-python/DocGen, so that I can easily run and configure the documentation generator.

#### Acceptance Criteria

1. THE DocGen_System SHALL be located in M:\K_OS\src-python\DocGen
2. THE DocGen_System SHALL provide a main entry point script (e.g., generate.py)
3. THE DocGen_System SHALL use a configuration file (docgen_config.json) for settings
4. THE DocGen_System SHALL support command-line arguments for target directories
5. THE DocGen_System SHALL implement the sandboxed file access layer
6. THE DocGen_System SHALL manage LLM API client initialization and request handling
7. THE DocGen_System SHALL provide progress logging and error reporting

### Requirement 16: AI Agent Prompt Engineering

**User Story:** As a documentation quality maintainer, I want well-engineered prompts for the AI agent, so that generated READMEs are consistent and follow K_OS conventions.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide a system prompt that defines the AI agent's role and constraints
2. THE system prompt SHALL include the staleness disclaimer requirement
3. THE system prompt SHALL include K_OS project conventions (data-driven, library-first, GPU-first)
4. THE system prompt SHALL instruct the AI to focus on architecture over file-by-file details
5. THE DocGen_System SHALL provide directory-specific context in each generation request
6. WHERE analyzing Rust crates, THE prompt SHALL include Cargo.toml contents and module structure
7. WHERE analyzing frontend code, THE prompt SHALL include component hierarchy and state management patterns

### Requirement 17: Parallel Directory Processing

**User Story:** As a developer, I want the system to process multiple directories in parallel, so that documentation generation completes quickly across the entire codebase.

#### Acceptance Criteria

1. THE DocGen_System SHALL support concurrent processing of multiple directories
2. THE DocGen_System SHALL respect LLM API rate limits when parallelizing requests
3. THE DocGen_System SHALL provide a --concurrency flag to control parallel execution
4. THE DocGen_System SHALL default to 3-5 concurrent requests to balance speed and API limits
5. THE DocGen_System SHALL aggregate results and report overall progress
6. WHERE an API error occurs, THE DocGen_System SHALL retry that directory without blocking others

### Requirement 18: Analysis Caching and Incremental Updates

**User Story:** As a developer, I want the system to cache analysis results, so that regenerating documentation is fast when only a few directories have changed.

#### Acceptance Criteria

1. THE DocGen_System SHALL maintain a cache of directory analysis metadata
2. THE cache SHALL include file modification timestamps and content hashes
3. WHEN a directory's files have not changed, THE DocGen_System SHALL skip re-analysis
4. THE DocGen_System SHALL provide a --force-refresh flag to bypass caching
5. THE cache SHALL be stored in src-python/DocGen/.cache/ as JSON files
6. THE DocGen_System SHALL invalidate cache entries when directory structure changes

### Requirement 19: Cost Tracking and Budget Limits

**User Story:** As a solo developer, I want to track and limit LLM API costs, so that documentation generation doesn't result in unexpected expenses.

#### Acceptance Criteria

1. THE DocGen_System SHALL track token usage per API request
2. THE DocGen_System SHALL estimate costs based on provider pricing
3. THE DocGen_System SHALL provide a --max-cost flag to set spending limits
4. WHEN the cost limit is reached, THE DocGen_System SHALL stop processing and report status
5. THE DocGen_System SHALL log cumulative costs to a cost_log.json file
6. THE DocGen_System SHALL display estimated cost before starting batch operations

### Requirement 20: Quality Validation and Review Mode

**User Story:** As a documentation maintainer, I want to review AI-generated content before committing, so that I can ensure quality and accuracy.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide a --review-mode flag for interactive approval
2. IN review mode, THE DocGen_System SHALL display generated README content before writing
3. THE DocGen_System SHALL prompt for approval (approve/reject/edit) for each README
4. WHERE rejected, THE DocGen_System SHALL skip writing that README
5. WHERE edited, THE DocGen_System SHALL allow inline modifications before writing
6. THE DocGen_System SHALL provide a --auto-approve flag to skip review for batch operations

### Requirement 21: Semantic Code Search with LanceDB

**User Story:** As a documentation system, I want to semantically search and understand code changes, so that I can intelligently update existing documentation based on what actually changed.

#### Acceptance Criteria

1. THE DocGen_System SHALL use LanceDB as the vector database for semantic code search
2. THE DocGen_System SHALL embed code files using a sentence-transformer model (e.g., all-MiniLM-L6-v2)
3. THE DocGen_System SHALL store embeddings in a LanceDB table with metadata (file_path, last_modified, content_hash)
4. WHEN analyzing a directory, THE DocGen_System SHALL query LanceDB for semantically similar code sections
5. THE DocGen_System SHALL use semantic search to identify related modules and dependencies
6. THE DocGen_System SHALL update embeddings incrementally when files change
7. THE LanceDB database SHALL be stored in src-python/DocGen/.lancedb/

### Requirement 22: GPU-Accelerated Embedding Generation

**User Story:** As a performance-conscious developer, I want to leverage my Quadro RTX 4000 GPU for fast embedding generation, so that documentation generation is blazingly fast.

#### Acceptance Criteria

1. THE DocGen_System SHALL use ONNX Runtime with CUDA execution provider for embedding generation
2. THE DocGen_System SHALL detect CUDA availability and fall back to CPU if unavailable
3. THE DocGen_System SHALL batch embed multiple code files in parallel on GPU
4. THE DocGen_System SHALL use FP16 precision for faster inference on RTX 4000
5. THE DocGen_System SHALL log GPU utilization and embedding generation speed
6. WHERE CUDA is available, THE DocGen_System SHALL process embeddings at least 10x faster than CPU
7. THE DocGen_System SHALL manage GPU memory efficiently to avoid OOM on 8GB VRAM

### Requirement 23: Change Detection and Diff Analysis

**User Story:** As a documentation maintainer, I want the system to detect what changed in the codebase, so that only affected documentation is regenerated.

#### Acceptance Criteria

1. THE DocGen_System SHALL compute content hashes (SHA-256) for all analyzed files
2. THE DocGen_System SHALL compare current hashes against cached hashes to detect changes
3. WHEN a file changes, THE DocGen_System SHALL perform a semantic diff to understand the nature of changes
4. THE DocGen_System SHALL classify changes as: structural (new modules/functions), behavioral (logic changes), or cosmetic (comments/formatting)
5. WHERE only cosmetic changes occur, THE DocGen_System SHALL skip README regeneration
6. WHERE structural or behavioral changes occur, THE DocGen_System SHALL regenerate affected READMEs
7. THE DocGen_System SHALL log a change summary showing what triggered each regeneration

### Requirement 24: MCP Server Integration

**User Story:** As a Kiro user, I want to interact with the documentation system through an MCP server, so that I can generate and query documentation directly from Kiro.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide an MCP server implementation
2. THE MCP server SHALL expose tools for: generate_readme, query_docs, analyze_changes, search_code
3. THE MCP server SHALL run as a standalone process that Kiro can connect to
4. THE MCP server SHALL use stdio transport for communication with Kiro
5. THE MCP server SHALL provide JSON-RPC 2.0 compliant responses
6. THE MCP server SHALL be configurable in Kiro's mcp.json with command and args
7. THE MCP server SHALL log all tool invocations for debugging

### Requirement 25: Standalone Executable Distribution

**User Story:** As a developer, I want a standalone executable for the documentation system, so that I can run it without Python environment setup.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide a standalone .exe build using PyInstaller or Nuitka
2. THE executable SHALL bundle all dependencies including ONNX Runtime and CUDA libraries
3. THE executable SHALL be located in dist/docgen.exe after build
4. THE executable SHALL support all CLI flags and MCP server mode
5. THE executable SHALL be under 500MB in size (compressed)
6. THE executable SHALL run on Windows 10/11 without additional dependencies
7. THE build process SHALL be automated with a build script (build_exe.bat)

### Requirement 26: Semantic Documentation Query Interface

**User Story:** As a developer, I want to semantically query the generated documentation, so that I can quickly find relevant information across the codebase.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide a query command: `docgen query "how does GPU pipeline work"`
2. THE query command SHALL embed the query using the same model as code embeddings
3. THE query command SHALL search LanceDB for semantically similar documentation sections
4. THE query command SHALL return top-k results (default k=5) with relevance scores
5. THE query command SHALL highlight the relevant sections in the returned documentation
6. THE query command SHALL support filtering by directory (e.g., --path crates/k-os-gpu-pipeline)
7. THE MCP server SHALL expose this as a query_docs tool for Kiro integration

### Requirement 27: Incremental Embedding Updates

**User Story:** As a developer making frequent code changes, I want embeddings to update incrementally, so that the system stays current without full re-indexing.

#### Acceptance Criteria

1. THE DocGen_System SHALL detect changed files using file modification timestamps
2. WHEN a file changes, THE DocGen_System SHALL re-embed only that file
3. THE DocGen_System SHALL update the LanceDB table with new embeddings using upsert operations
4. THE DocGen_System SHALL maintain embedding version metadata to handle model upgrades
5. WHERE the embedding model changes, THE DocGen_System SHALL trigger a full re-index
6. THE DocGen_System SHALL provide a --reindex flag to force full re-embedding
7. THE incremental update SHALL complete in under 5 seconds for typical single-file changes

### Requirement 28: Cross-Reference Detection

**User Story:** As a documentation reader, I want to see cross-references between related modules, so that I can understand dependencies and relationships.

#### Acceptance Criteria

1. THE AI_Documentation_Agent SHALL use semantic search to find related modules
2. THE AI_Documentation_Agent SHALL include a "Related Modules" section in generated READMEs
3. THE related modules SHALL be ranked by semantic similarity (top 5)
4. THE AI_Documentation_Agent SHALL detect import statements and dependency relationships
5. WHERE a module imports from another, THE README SHALL explicitly note the dependency
6. THE AI_Documentation_Agent SHALL identify circular dependencies and warn in documentation
7. THE cross-references SHALL include relative file paths for easy navigation

### Requirement 29: Documentation Quality Metrics

**User Story:** As a documentation maintainer, I want quality metrics for generated documentation, so that I can identify areas needing improvement.

#### Acceptance Criteria

1. THE DocGen_System SHALL compute quality metrics for each generated README
2. THE metrics SHALL include: completeness score, clarity score, example coverage, cross-reference density
3. THE DocGen_System SHALL flag READMEs with quality scores below 70% for review
4. THE DocGen_System SHALL provide a --report flag to generate a quality report (markdown table)
5. THE quality report SHALL list all READMEs sorted by quality score
6. THE DocGen_System SHALL track quality trends over time in a metrics_history.json file
7. THE MCP server SHALL expose a get_quality_metrics tool for Kiro integration

### Requirement 30: Hot-Reload and Watch Mode

**User Story:** As a developer actively coding, I want documentation to auto-regenerate when I save files, so that docs stay current in real-time.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide a --watch flag to enable file watching
2. IN watch mode, THE DocGen_System SHALL monitor target directories for file changes
3. WHEN a file is saved, THE DocGen_System SHALL trigger incremental analysis and regeneration
4. THE watch mode SHALL debounce rapid changes (wait 2 seconds after last change)
5. THE watch mode SHALL log each regeneration with timestamp and affected files
6. THE watch mode SHALL continue running until interrupted (Ctrl+C)
7. THE watch mode SHALL respect the same cost limits and review settings as batch mode

### Requirement 31: On-Demand Indexing (No Background Processing)

**User Story:** As a developer working across multiple IDEs, I want the indexing system to run on-demand only, so that it doesn't consume GPU resources while I'm working.

#### Acceptance Criteria

1. THE DocGen_System SHALL NOT run any background processes or daemons
2. THE DocGen_System SHALL provide a separate script `update_index.py` for manual index updates
3. THE ONNX Runtime SHALL only be loaded when explicitly running indexing operations
4. THE GPU SHALL be released immediately after indexing completes
5. THE MCP server SHALL NOT perform embedding generation - only query existing embeddings
6. THE MCP server SHALL be lightweight and CPU-only (no GPU usage)
7. THE DocGen_System SHALL log GPU memory usage and release confirmation after each indexing run

### Requirement 32: Lightweight Index Update Script

**User Story:** As a developer, I want a fast, lean indexing script that detects changes and updates only what's needed, so that keeping the index current is effortless.

#### Acceptance Criteria

1. THE update_index.py script SHALL scan target directories for file changes
2. THE script SHALL use file modification timestamps and content hashes to detect changes
3. THE script SHALL batch changed files and embed them in a single GPU pass
4. THE script SHALL complete indexing of typical changes (5-10 files) in under 10 seconds
5. THE script SHALL provide a --full-reindex flag for complete re-indexing
6. THE script SHALL log: files scanned, files changed, embeddings generated, GPU time, total time
7. THE script SHALL be runnable as: `python src-python/DocGen/update_index.py`

### Requirement 33: Codebase Repository Map Generation

**User Story:** As a developer and AI agent, I want a comprehensive repository map that shows the structure and relationships of the entire codebase, so that I can understand the big picture.

#### Acceptance Criteria

1. THE DocGen_System SHALL generate a repository map file: `REPO_MAP.md`
2. THE repository map SHALL include a hierarchical tree of all directories and key files
3. THE repository map SHALL include module dependency graphs (imports, exports, relationships)
4. THE repository map SHALL include semantic clusters (groups of related modules by embedding similarity)
5. THE repository map SHALL include a "Key Entry Points" section listing main apps, commands, and APIs
6. THE repository map SHALL include a "Data Flow" section showing how data moves through the system
7. THE repository map SHALL be regenerated whenever the index is updated

### Requirement 34: Semantic Connection Discovery

**User Story:** As an AI agent analyzing the codebase, I want to discover semantic connections between modules, so that I can understand implicit relationships beyond explicit imports.

#### Acceptance Criteria

1. THE DocGen_System SHALL compute semantic similarity between all indexed code files
2. THE DocGen_System SHALL identify "hidden connections" where modules are semantically similar but don't import each other
3. THE DocGen_System SHALL store connection strength scores (0.0 to 1.0) in LanceDB metadata
4. THE DocGen_System SHALL generate a connections graph showing top-k connections per module (k=10)
5. THE connections graph SHALL be exported as JSON for programmatic access
6. THE connections graph SHALL be visualized in REPO_MAP.md as a mermaid diagram
7. THE AI_Documentation_Agent SHALL use these connections to suggest related modules in READMEs

### Requirement 35: LLM Knowledge Base Construction

**User Story:** As a system architect, I want the vector database to function as an LLM knowledge base, so that the system can answer complex questions about the codebase.

#### Acceptance Criteria

1. THE DocGen_System SHALL index not just code, but also: comments, docstrings, README files, and documentation
2. THE DocGen_System SHALL create hierarchical embeddings at multiple levels: function, class, module, directory
3. THE DocGen_System SHALL support multi-hop reasoning by chaining semantic queries
4. THE DocGen_System SHALL provide a knowledge_query tool that answers questions using RAG (Retrieval-Augmented Generation)
5. THE knowledge_query tool SHALL retrieve top-k relevant chunks, then pass to LLM for synthesis
6. THE knowledge_query tool SHALL cite sources with file paths and line numbers
7. THE MCP server SHALL expose knowledge_query as a tool for Kiro integration

### Requirement 36: Index Health and Statistics

**User Story:** As a developer, I want to see statistics about the index health, so that I know when it needs updating.

#### Acceptance Criteria

1. THE DocGen_System SHALL provide an `index_stats.py` script to show index health
2. THE stats SHALL include: total files indexed, total embeddings, index size (MB), last update time
3. THE stats SHALL include: files out of sync (modified but not re-indexed), staleness score
4. THE stats SHALL include: embedding model version, GPU used for last index
5. THE stats SHALL include: semantic coverage (% of codebase with embeddings)
6. THE stats SHALL be displayed as a formatted table in the terminal
7. THE MCP server SHALL expose get_index_stats as a tool for Kiro integration

### Requirement 37: Incremental Repo Map Updates

**User Story:** As a developer making frequent changes, I want the repo map to update incrementally, so that it stays current without full regeneration.

#### Acceptance Criteria

1. WHEN update_index.py runs, THE DocGen_System SHALL update only affected sections of REPO_MAP.md
2. WHERE a new module is added, THE DocGen_System SHALL insert it into the appropriate section
3. WHERE a module is deleted, THE DocGen_System SHALL remove it from the repo map
4. WHERE dependencies change, THE DocGen_System SHALL update the dependency graph
5. THE incremental update SHALL preserve manually-added sections marked with preservation tags
6. THE incremental update SHALL complete in under 5 seconds for typical changes
7. THE DocGen_System SHALL provide a --full-remap flag to regenerate the entire repo map
