"""
README Generator for DocGen System

This module orchestrates LLM-powered README generation with semantic search integration.
It builds system and user prompts following K_OS conventions, queries LanceDB for related
modules, preserves manual content sections, and merges generated content with manual sections.

Features:
- LLM-powered architectural documentation generation
- Semantic search for cross-references (top 5 related modules)
- Manual content preservation with HTML comment tags
- K_OS convention integration (data-driven, library-first, GPU-first)
- Staleness disclaimer enforcement
- Directory type detection (Rust crates, React apps, Tauri backend, etc.)

Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 8.2, 8.3, 16.1, 16.2, 16.3, 16.4, 28.1, 28.2, 28.3
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional

from .llm_client import LLMClient, LLMResponse
from .file_access import SandboxedFileAccess
from .lance_db import LanceDBManager, SearchResult
from .embedding_engine import EmbeddingEngine

logger = logging.getLogger(__name__)


@dataclass
class DirectoryContext:
    """
    Context information for a directory being documented.
    
    Attributes:
        dir_path: Path to directory being documented
        file_tree: List of files in directory
        cargo_toml: Contents of Cargo.toml if present (Rust crates)
        package_json: Contents of package.json if present (frontend)
        key_files: Dictionary of important files and their contents
        related_modules: Semantically similar modules from LanceDB
        directory_type: Type classification (rust_crate, react_app, tauri_backend, etc.)
    """
    dir_path: Path
    file_tree: List[Path] = field(default_factory=list)
    cargo_toml: Optional[str] = None
    package_json: Optional[str] = None
    key_files: Dict[str, str] = field(default_factory=dict)
    related_modules: List[SearchResult] = field(default_factory=list)
    directory_type: str = "unknown"


class READMEGenerator:
    """
    Orchestrates LLM-powered README generation with semantic search.
    
    This class coordinates the entire README generation process:
    1. Analyzes directory structure and detects type
    2. Queries LanceDB for semantically related modules
    3. Builds system prompt with K_OS conventions
    4. Builds user prompt with directory-specific context
    5. Calls LLM to generate README content
    6. Preserves manual sections from existing README
    7. Merges generated and manual content
    
    Attributes:
        llm_client: LLM API client for content generation
        file_access: Sandboxed file access layer
        lance_db: LanceDB manager for semantic search
        embedding_engine: Embedding engine for query embeddings (optional)
        staleness_disclaimer: Required disclaimer text
    """
    
    # Staleness disclaimer (Requirement 2.2)
    STALENESS_DISCLAIMER = (
        "*This README may be out of date and inspecting the current code is the best way. "
        "NEVER ASSUME THIS README IS CURRENT ARCHITECTURE, BUT RATHER TREAT IT AS A BASELINE "
        "FOR what's in this folder*"
    )
    
    # Manual content preservation tags
    MANUAL_START_TAG = "<!-- MANUAL_CONTENT_START -->"
    MANUAL_END_TAG = "<!-- MANUAL_CONTENT_END -->"
    
    def __init__(
        self,
        llm_client: LLMClient,
        file_access: SandboxedFileAccess,
        lance_db: LanceDBManager,
        embedding_engine: Optional[EmbeddingEngine] = None
    ):
        """
        Initialize the README generator.
        
        Args:
            llm_client: LLM API client for content generation
            file_access: Sandboxed file access layer
            lance_db: LanceDB manager for semantic search
            embedding_engine: Optional embedding engine for query embeddings
        """
        self.llm_client = llm_client
        self.file_access = file_access
        self.lance_db = lance_db
        self.embedding_engine = embedding_engine
        self.staleness_disclaimer = self.STALENESS_DISCLAIMER
        
        logger.info("READMEGenerator initialized")
    
    async def generate_readme(
        self,
        dir_path: Path,
        context: Optional[DirectoryContext] = None
    ) -> str:
        """
        Generate README content for a directory.
        
        This is the main orchestration method that:
        1. Builds directory context if not provided
        2. Queries LanceDB for related modules
        3. Builds system and user prompts
        4. Calls LLM to generate content
        5. Preserves manual sections if README exists
        6. Merges generated and manual content
        
        Args:
            dir_path: Path to directory to document
            context: Optional pre-built directory context
        
        Returns:
            Complete README content as markdown string
        
        Raises:
            RuntimeError: If README generation fails
        
        Requirements: 2.1, 3.1, 8.2, 28.1
        """
        logger.info(f"Generating README for: {dir_path}")
        
        try:
            # Build context if not provided
            if context is None:
                context = self._build_directory_context(dir_path)
            
            # Query LanceDB for related modules (Requirement 28.1)
            if self.embedding_engine:
                context.related_modules = await self._find_related_modules(context)
            
            # Build prompts
            system_prompt = self.build_system_prompt()
            user_prompt = self.build_user_prompt(context)
            
            # Generate content with LLM
            logger.info(f"Calling LLM to generate README for {dir_path}")
            response: LLMResponse = await self.llm_client.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt
            )
            
            generated_content = response.content
            
            # Check if existing README has manual sections
            readme_path = dir_path / "README.md"
            manual_sections = []
            
            if self.file_access.file_exists(readme_path):
                existing_readme = self.file_access.read_file(readme_path)
                manual_sections = self.extract_manual_sections(existing_readme)
            
            # Merge generated content with manual sections
            if manual_sections:
                final_content = self.merge_content(generated_content, manual_sections)
            else:
                final_content = generated_content
            
            # Ensure staleness disclaimer is at the top (Requirement 2.1, 2.3)
            final_content = self._ensure_staleness_disclaimer(final_content)
            
            logger.info(
                f"README generated successfully: {len(final_content)} chars, "
                f"cost: ${response.cost_usd:.4f}"
            )
            
            return final_content
        
        except Exception as e:
            logger.error(f"Failed to generate README for {dir_path}: {e}")
            raise RuntimeError(f"README generation failed: {e}")
    
    def build_system_prompt(self) -> str:
        """
        Build system prompt with K_OS conventions and constraints.
        
        The system prompt defines the AI agent's role, constraints, and output format.
        It includes:
        - Role definition as documentation agent
        - File access constraints (read all, write .md only)
        - Staleness disclaimer requirement
        - K_OS principles (data-driven, library-first, GPU-first)
        - Output format specification
        
        Returns:
            System prompt as string
        
        Requirements: 16.1, 16.2, 16.3, 16.4
        """
        return f"""You are an AI documentation agent for the K_OS DCC Suite. Your role is to generate 
high-quality README.md files that provide architectural overviews of code directories.

CONSTRAINTS:
- You have READ access to all files in the codebase
- You have WRITE access ONLY to .md files
- You MUST include the staleness disclaimer at the top of every README
- Focus on ARCHITECTURE and PATTERNS, not file-by-file listings
- Keep READMEs concise (500-1000 words)
- Use proper markdown formatting with code blocks

K_OS PRINCIPLES:
- Data-driven: Prefer configuration over hardcoding. Look for JSON configs, registries, and schemas.
- Library-first: Use battle-tested libraries (wgpu, Three.js, LanceDB, Tauri, React, etc.). Never reinvent the wheel.
- GPU-first: Leverage CUDA and GPU compute for performance. Target maximum raw power.

STALENESS DISCLAIMER (required at top of every README):
{self.STALENESS_DISCLAIMER}

OUTPUT FORMAT:
# [Directory Name]

{self.STALENESS_DISCLAIMER}

## Overview
[High-level purpose and role in K_OS - 2-3 paragraphs]

## Architecture
[Key patterns, abstractions, system boundaries - focus on HOW things work]

## Key Components
[Major modules/classes/functions with brief descriptions - NOT a file listing]

## Usage Patterns
[Typical usage examples, integration points, common workflows]

## Related Modules
[Semantically similar modules - will be provided in context]

IMPORTANT:
- Do NOT enumerate every file in the directory
- Focus on system-level concepts and relationships
- Explain WHY things are structured the way they are
- Include minimal code examples (10-15 lines max) only if helpful
- Use the related modules information to explain dependencies and connections
"""
    
    def build_user_prompt(self, context: DirectoryContext) -> str:
        """
        Build user prompt with directory-specific context.
        
        The user prompt provides the LLM with specific information about the
        directory being documented, including:
        - Directory path and type
        - File tree structure
        - Contents of key configuration files (Cargo.toml, package.json)
        - Excerpts from important source files
        - Related modules from semantic search
        
        Args:
            context: Directory context with all relevant information
        
        Returns:
            User prompt as string
        
        Requirements: 16.5, 16.6, 16.7
        """
        prompt_parts = [
            f"Generate a README for the following directory:\n",
            f"**Directory:** {context.dir_path}",
            f"**Type:** {context.directory_type}\n"
        ]
        
        # Add file tree
        if context.file_tree:
            prompt_parts.append("**File Tree:**")
            for file_path in context.file_tree[:20]:  # Limit to first 20 files
                prompt_parts.append(f"  - {file_path.name}")
            if len(context.file_tree) > 20:
                prompt_parts.append(f"  ... and {len(context.file_tree) - 20} more files")
            prompt_parts.append("")
        
        # Add Cargo.toml for Rust crates (Requirement 16.6)
        if context.cargo_toml:
            prompt_parts.append("**Cargo.toml:**")
            prompt_parts.append("```toml")
            prompt_parts.append(context.cargo_toml[:1000])  # Limit to 1000 chars
            if len(context.cargo_toml) > 1000:
                prompt_parts.append("... (truncated)")
            prompt_parts.append("```\n")
        
        # Add package.json for frontend (Requirement 16.7)
        if context.package_json:
            prompt_parts.append("**package.json:**")
            prompt_parts.append("```json")
            prompt_parts.append(context.package_json[:1000])  # Limit to 1000 chars
            if len(context.package_json) > 1000:
                prompt_parts.append("... (truncated)")
            prompt_parts.append("```\n")
        
        # Add key files
        if context.key_files:
            prompt_parts.append("**Key Files:**")
            for filename, content in context.key_files.items():
                prompt_parts.append(f"\n**{filename}:**")
                prompt_parts.append("```")
                # Limit each file to 500 chars
                prompt_parts.append(content[:500])
                if len(content) > 500:
                    prompt_parts.append("... (truncated)")
                prompt_parts.append("```")
            prompt_parts.append("")
        
        # Add related modules (Requirement 28.2, 28.3)
        if context.related_modules:
            prompt_parts.append("**Related Modules (by semantic similarity):**")
            for i, result in enumerate(context.related_modules[:5], 1):
                prompt_parts.append(
                    f"{i}. `{result.file_path}` (similarity: {result.similarity_score:.2f})"
                )
                if result.module_name:
                    prompt_parts.append(f"   - Module: {result.module_name}")
            prompt_parts.append("")
            prompt_parts.append(
                "Use these related modules to explain dependencies and connections in the README."
            )
        
        return "\n".join(prompt_parts)
    
    def extract_manual_sections(self, existing_readme: str) -> List[str]:
        """
        Extract sections marked with preservation tags from existing README.
        
        Manual sections are marked with:
        <!-- MANUAL_CONTENT_START -->
        ... manual content ...
        <!-- MANUAL_CONTENT_END -->
        
        Args:
            existing_readme: Content of existing README.md
        
        Returns:
            List of manual content sections (including tags)
        
        Requirement: 8.2
        """
        manual_sections = []
        
        # Find all manual content blocks
        pattern = re.compile(
            rf'{re.escape(self.MANUAL_START_TAG)}(.*?){re.escape(self.MANUAL_END_TAG)}',
            re.DOTALL
        )
        
        matches = pattern.findall(existing_readme)
        
        for match in matches:
            # Include the tags in the preserved content
            section = f"{self.MANUAL_START_TAG}{match}{self.MANUAL_END_TAG}"
            manual_sections.append(section)
        
        if manual_sections:
            logger.info(f"Extracted {len(manual_sections)} manual sections from existing README")
        
        return manual_sections
    
    def merge_content(self, generated: str, manual_sections: List[str]) -> str:
        """
        Merge generated content with preserved manual sections.
        
        Appends manual sections at the end of the generated content, before
        any generation timestamp or metadata.
        
        Args:
            generated: Generated README content
            manual_sections: List of manual content sections to preserve
        
        Returns:
            Merged README content
        
        Requirement: 8.3
        """
        if not manual_sections:
            return generated
        
        # Append manual sections at the end
        merged_parts = [generated.rstrip()]
        
        merged_parts.append("\n\n---\n")
        merged_parts.append("## Manual Sections\n")
        
        for section in manual_sections:
            merged_parts.append(section)
            merged_parts.append("\n")
        
        merged_content = "\n".join(merged_parts)
        
        logger.info(f"Merged {len(manual_sections)} manual sections into generated content")
        
        return merged_content
    
    def _build_directory_context(self, dir_path: Path) -> DirectoryContext:
        """
        Build directory context by analyzing files and structure.
        
        Args:
            dir_path: Path to directory
        
        Returns:
            DirectoryContext with analyzed information
        """
        context = DirectoryContext(dir_path=dir_path)
        
        # List files in directory
        try:
            all_paths = self.file_access.list_directory(dir_path, recursive=False)
            context.file_tree = [p for p in all_paths if (self.file_access.root_path / p).is_file()]
        except Exception as e:
            logger.warning(f"Failed to list directory {dir_path}: {e}")
        
        # Detect directory type
        context.directory_type = self._detect_directory_type(dir_path, context.file_tree)
        
        # Read key configuration files
        cargo_toml_path = dir_path / "Cargo.toml"
        if self.file_access.file_exists(cargo_toml_path):
            try:
                context.cargo_toml = self.file_access.read_file(cargo_toml_path)
            except Exception as e:
                logger.warning(f"Failed to read Cargo.toml: {e}")
        
        package_json_path = dir_path / "package.json"
        if self.file_access.file_exists(package_json_path):
            try:
                context.package_json = self.file_access.read_file(package_json_path)
            except Exception as e:
                logger.warning(f"Failed to read package.json: {e}")
        
        # Read key source files (limit to 3 most important)
        key_files = self._identify_key_files(dir_path, context.file_tree, context.directory_type)
        for file_path in key_files[:3]:
            try:
                full_path = self.file_access.root_path / file_path
                content = self.file_access.read_file(full_path)
                context.key_files[file_path.name] = content
            except Exception as e:
                logger.warning(f"Failed to read key file {file_path}: {e}")
        
        return context
    
    def _detect_directory_type(self, dir_path: Path, file_tree: List[Path]) -> str:
        """
        Detect directory type based on files present.
        
        Args:
            dir_path: Path to directory
            file_tree: List of files in directory
        
        Returns:
            Directory type string
        
        Requirement: 8.3
        """
        file_names = [f.name for f in file_tree]
        dir_name = dir_path.name.lower()
        
        # Check for Rust crate
        if "Cargo.toml" in file_names:
            return "rust_crate"
        
        # Check for React app (K*.tsx pattern)
        if any(f.startswith("K") and f.endswith(".tsx") for f in file_names):
            return "react_app"
        
        # Check for Tauri backend
        if "main.rs" in file_names and "tauri" in str(dir_path).lower():
            return "tauri_backend"
        
        # Check for UI directory
        if dir_name == "ui":
            return "ui_components"
        
        # Check for engine directory
        if dir_name == "engine":
            return "engine_logic"
        
        # Check for GPU shaders
        if any(f.endswith(".wgsl") for f in file_names):
            return "gpu_shaders"
        
        # Check for test directory
        if "test" in dir_name or any("test" in f for f in file_names):
            return "test_directory"
        
        # Check for TypeScript/JavaScript
        if any(f.endswith((".ts", ".tsx", ".js", ".jsx")) for f in file_names):
            return "typescript_module"
        
        # Check for Python
        if any(f.endswith(".py") for f in file_names):
            return "python_module"
        
        return "unknown"
    
    def _identify_key_files(
        self,
        dir_path: Path,
        file_tree: List[Path],
        directory_type: str
    ) -> List[Path]:
        """
        Identify key files to include in context based on directory type.
        
        Args:
            dir_path: Path to directory
            file_tree: List of files in directory
            directory_type: Detected directory type
        
        Returns:
            List of key file paths (relative to root)
        """
        key_files = []
        file_names = {f.name: f for f in file_tree}
        
        # Rust crate: lib.rs or main.rs
        if directory_type == "rust_crate":
            if "lib.rs" in file_names:
                key_files.append(file_names["lib.rs"])
            elif "main.rs" in file_names:
                key_files.append(file_names["main.rs"])
        
        # React app: K*.tsx entry point
        elif directory_type == "react_app":
            for name, path in file_names.items():
                if name.startswith("K") and name.endswith(".tsx"):
                    key_files.append(path)
                    break
        
        # TypeScript: index.ts or main entry point
        elif directory_type == "typescript_module":
            if "index.ts" in file_names:
                key_files.append(file_names["index.ts"])
            elif "index.tsx" in file_names:
                key_files.append(file_names["index.tsx"])
        
        # Python: __init__.py or main.py
        elif directory_type == "python_module":
            if "__init__.py" in file_names:
                key_files.append(file_names["__init__.py"])
            elif "main.py" in file_names:
                key_files.append(file_names["main.py"])
        
        return key_files
    
    async def _find_related_modules(self, context: DirectoryContext) -> List[SearchResult]:
        """
        Find semantically related modules using LanceDB.
        
        Creates a query embedding from the directory context and searches
        for the top 5 most similar code files.
        
        Args:
            context: Directory context
        
        Returns:
            List of SearchResult objects (top 5 by similarity)
        
        Requirements: 28.1, 28.2
        """
        if not self.embedding_engine:
            logger.warning("No embedding engine available for semantic search")
            return []
        
        try:
            # Build query text from directory context
            query_parts = [
                f"Directory: {context.dir_path.name}",
                f"Type: {context.directory_type}"
            ]
            
            # Add file names
            if context.file_tree:
                file_names = [f.name for f in context.file_tree[:10]]
                query_parts.append(f"Files: {', '.join(file_names)}")
            
            # Add cargo/package info
            if context.cargo_toml:
                query_parts.append(context.cargo_toml[:200])
            if context.package_json:
                query_parts.append(context.package_json[:200])
            
            query_text = "\n".join(query_parts)
            
            # Generate query embedding
            logger.info(f"Generating query embedding for: {context.dir_path}")
            query_embedding = self.embedding_engine.embed_single(query_text)
            
            # Search LanceDB for similar modules
            results = self.lance_db.search_similar(
                query_embedding=query_embedding,
                k=5  # Top 5 results (Requirement 28.3)
            )
            
            logger.info(f"Found {len(results)} related modules for {context.dir_path}")
            
            return results
        
        except Exception as e:
            logger.error(f"Failed to find related modules: {e}")
            return []
    
    def _ensure_staleness_disclaimer(self, content: str) -> str:
        """
        Ensure staleness disclaimer is at the top of the README.
        
        Args:
            content: README content
        
        Returns:
            Content with staleness disclaimer at top
        
        Requirements: 2.1, 2.3
        """
        # Check if disclaimer already exists
        if self.STALENESS_DISCLAIMER in content:
            # If it's not at the very beginning (after title), move it there
            lines = content.split('\n')
            
            # Find title line (starts with #)
            title_idx = -1
            for i, line in enumerate(lines):
                if line.strip().startswith('# '):
                    title_idx = i
                    break
            
            # Remove existing disclaimer
            filtered_lines = [
                line for line in lines
                if self.STALENESS_DISCLAIMER not in line
            ]
            
            # Insert disclaimer after title
            if title_idx >= 0:
                filtered_lines.insert(title_idx + 1, "")
                filtered_lines.insert(title_idx + 2, self.STALENESS_DISCLAIMER)
                filtered_lines.insert(title_idx + 3, "")
            else:
                # No title found, add at beginning
                filtered_lines.insert(0, self.STALENESS_DISCLAIMER)
                filtered_lines.insert(1, "")
            
            return '\n'.join(filtered_lines)
        else:
            # Disclaimer not present, add it after title
            lines = content.split('\n')
            
            # Find title line
            title_idx = -1
            for i, line in enumerate(lines):
                if line.strip().startswith('# '):
                    title_idx = i
                    break
            
            if title_idx >= 0:
                lines.insert(title_idx + 1, "")
                lines.insert(title_idx + 2, self.STALENESS_DISCLAIMER)
                lines.insert(title_idx + 3, "")
            else:
                # No title, add at beginning
                lines.insert(0, self.STALENESS_DISCLAIMER)
                lines.insert(1, "")
            
            return '\n'.join(lines)

    
    def detect_imports(self, file_path: Path) -> List[str]:
        """
        Detect import statements in a source file.
        
        Supports:
        - Rust: use statements
        - TypeScript/JavaScript: import statements
        - Python: import and from...import statements
        
        Args:
            file_path: Path to source file
            
        Returns:
            List of imported module paths
            
        Requirement: 28.4
        """
        try:
            content = self.file_access.read_file(file_path)
            imports = []
            
            # Detect file type
            suffix = file_path.suffix.lower()
            
            if suffix == '.rs':
                # Rust: use crate::module::path;
                rust_pattern = r'use\s+((?:crate|super|self)?::?[\w:]+)'
                matches = re.findall(rust_pattern, content)
                imports.extend(matches)
            
            elif suffix in ['.ts', '.tsx', '.js', '.jsx']:
                # TypeScript/JavaScript: import ... from 'path'
                ts_pattern = r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]'
                matches = re.findall(ts_pattern, content)
                imports.extend(matches)
            
            elif suffix == '.py':
                # Python: import module or from module import ...
                py_pattern1 = r'import\s+([\w.]+)'
                py_pattern2 = r'from\s+([\w.]+)\s+import'
                matches1 = re.findall(py_pattern1, content)
                matches2 = re.findall(py_pattern2, content)
                imports.extend(matches1)
                imports.extend(matches2)
            
            return imports
        
        except Exception as e:
            logger.error(f"Failed to detect imports in {file_path}: {e}")
            return []
    
    def detect_circular_dependencies(
        self,
        dir_path: Path,
        max_depth: int = 3
    ) -> List[tuple[str, str]]:
        """
        Detect circular dependencies in a directory.
        
        Performs a simple cycle detection by building an import graph
        and checking for back edges.
        
        Args:
            dir_path: Directory to analyze
            max_depth: Maximum depth for cycle detection
            
        Returns:
            List of (module_a, module_b) tuples representing circular dependencies
            
        Requirement: 28.6
        """
        try:
            # Build import graph
            import_graph: Dict[str, List[str]] = {}
            
            # Scan all source files in directory
            for file_path in dir_path.rglob('*'):
                if file_path.suffix in ['.rs', '.ts', '.tsx', '.js', '.jsx', '.py']:
                    relative_path = str(file_path.relative_to(dir_path))
                    imports = self.detect_imports(file_path)
                    import_graph[relative_path] = imports
            
            # Detect cycles using DFS
            cycles = []
            visited = set()
            rec_stack = set()
            
            def dfs(node: str, path: List[str]) -> None:
                """DFS helper to detect cycles."""
                if node in rec_stack:
                    # Found a cycle
                    cycle_start = path.index(node)
                    cycle = path[cycle_start:]
                    if len(cycle) >= 2:
                        cycles.append((cycle[0], cycle[-1]))
                    return
                
                if node in visited:
                    return
                
                visited.add(node)
                rec_stack.add(node)
                path.append(node)
                
                # Visit neighbors
                for neighbor in import_graph.get(node, []):
                    # Convert import path to file path (simplified)
                    neighbor_file = neighbor.replace('::', '/').replace('.', '/') + '.rs'
                    if neighbor_file in import_graph:
                        dfs(neighbor_file, path[:])
                
                rec_stack.remove(node)
            
            # Run DFS from each node
            for node in import_graph:
                if node not in visited:
                    dfs(node, [])
            
            return cycles
        
        except Exception as e:
            logger.error(f"Failed to detect circular dependencies: {e}")
            return []
    
    def build_cross_reference_section(
        self,
        context: DirectoryContext,
        include_imports: bool = True,
        include_circular_deps: bool = True
    ) -> str:
        """
        Build a cross-reference section for the README.
        
        Includes:
        - Semantically similar modules (from LanceDB)
        - Import dependencies (detected from source files)
        - Circular dependency warnings (if detected)
        
        Args:
            context: Directory context with related modules
            include_imports: Whether to include import analysis
            include_circular_deps: Whether to check for circular dependencies
            
        Returns:
            Markdown formatted cross-reference section
            
        Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7
        """
        lines = ["## Related Modules", ""]
        
        # Add semantically similar modules (Requirement 28.2, 28.3)
        if context.related_modules:
            lines.append("### Semantically Similar")
            lines.append("")
            lines.append("These modules are related by semantic similarity:")
            lines.append("")
            
            for i, result in enumerate(context.related_modules[:5], 1):
                # Relative file path (Requirement 28.7)
                rel_path = result.file_path
                similarity = result.similarity_score
                
                lines.append(f"{i}. **[{rel_path}]({rel_path})** (similarity: {similarity:.2f})")
                
                if result.module_name:
                    lines.append(f"   - Module: `{result.module_name}`")
                
                if result.metadata:
                    # Add metadata hints
                    if 'description' in result.metadata:
                        lines.append(f"   - {result.metadata['description']}")
            
            lines.append("")
        
        # Add import dependencies (Requirement 28.4, 28.5)
        if include_imports:
            all_imports = set()
            
            for file_path in context.file_tree:
                if file_path.suffix in ['.rs', '.ts', '.tsx', '.js', '.jsx', '.py']:
                    imports = self.detect_imports(file_path)
                    all_imports.update(imports)
            
            if all_imports:
                lines.append("### Direct Dependencies")
                lines.append("")
                lines.append("This module imports from:")
                lines.append("")
                
                for imp in sorted(all_imports)[:10]:  # Limit to top 10
                    lines.append(f"- `{imp}`")
                
                lines.append("")
        
        # Check for circular dependencies (Requirement 28.6)
        if include_circular_deps:
            cycles = self.detect_circular_dependencies(context.dir_path)
            
            if cycles:
                lines.append("### ⚠️ Circular Dependencies Detected")
                lines.append("")
                lines.append("The following circular dependencies were found:")
                lines.append("")
                
                for module_a, module_b in cycles[:5]:  # Limit to top 5
                    lines.append(f"- `{module_a}` ↔ `{module_b}`")
                
                lines.append("")
                lines.append("Consider refactoring to break these cycles.")
                lines.append("")
        
        return '\n'.join(lines)
