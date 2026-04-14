"""
Repository Map Generator for DocGen System

This module generates a comprehensive repository map (REPO_MAP.md) that shows:
- Hierarchical directory structure with key files
- Semantic clusters of related modules (by embedding similarity)
- Key entry points (main apps, commands, APIs)
- Module dependency relationships

The repository map serves as a high-level navigation guide for developers and AI agents
to understand the overall structure and relationships within the K_OS codebase.

Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 34.1
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Set, Optional, Tuple
from datetime import datetime
import re

from .lance_db import LanceDBManager, SearchResult
from .file_access import SandboxedFileAccess

logger = logging.getLogger(__name__)


@dataclass
class DirectoryNode:
    """
    Represents a directory in the repository tree.
    
    Attributes:
        path: Path to directory (relative to root)
        name: Directory name
        children: Child directories
        key_files: Important files in this directory
        file_count: Total number of files in directory
    """
    path: Path
    name: str
    children: List['DirectoryNode'] = field(default_factory=list)
    key_files: List[str] = field(default_factory=list)
    file_count: int = 0


@dataclass
class SemanticCluster:
    """
    Represents a cluster of semantically related modules.
    
    Attributes:
        name: Cluster name (derived from common patterns)
        modules: List of file paths in cluster
        similarity_threshold: Minimum similarity score for cluster membership
        description: Brief description of cluster purpose
    """
    name: str
    modules: List[str] = field(default_factory=list)
    similarity_threshold: float = 0.70
    description: str = ""


@dataclass
class EntryPoint:
    """
    Represents a key entry point in the codebase.
    
    Attributes:
        name: Entry point name
        path: File path
        type: Entry point type (app, command, api, etc.)
        description: Brief description
    """
    name: str
    path: str
    type: str
    description: str = ""


class RepoMapGenerator:
    """
    Generates comprehensive repository maps showing structure and semantic connections.
    
    The repository map includes:
    1. Hierarchical directory tree with key files
    2. Semantic clusters of related modules (by embedding similarity)
    3. Key entry points (main apps, commands, APIs)
    4. Module dependency relationships
    
    Attributes:
        lance_db: LanceDB manager for semantic search
        file_access: Sandboxed file access layer
        root_path: Root directory of repository
        target_directories: Directories to include in map (e.g., crates/, apps/, sources/)
    """
    
    # File extensions to include in analysis
    CODE_EXTENSIONS = {'.rs', '.ts', '.tsx', '.py', '.wgsl', '.json', '.toml'}
    
    # Key file patterns to highlight in tree
    KEY_FILE_PATTERNS = [
        'main.rs', 'lib.rs', 'mod.rs',  # Rust
        'index.ts', 'index.tsx', 'main.ts',  # TypeScript
        '__init__.py', 'main.py',  # Python
        'Cargo.toml', 'package.json',  # Config
    ]
    
    # Entry point patterns
    ENTRY_POINT_PATTERNS = {
        'app': [r'K\w+\.tsx$', r'App\.tsx$'],  # React apps
        'command': [r'main\.rs$', r'commands?\.rs$'],  # Tauri commands
        'api': [r'api\.ts$', r'routes\.ts$'],  # API endpoints
        'pipeline': [r'pipeline\.rs$', r'\.wgsl$'],  # GPU pipelines
    }
    
    def __init__(
        self,
        lance_db: LanceDBManager,
        file_access: SandboxedFileAccess,
        target_directories: Optional[List[str]] = None
    ):
        """
        Initialize the repository map generator.
        
        Args:
            lance_db: LanceDB manager for semantic search
            file_access: Sandboxed file access layer
            target_directories: List of directories to include (default: crates, apps, sources)
        """
        self.lance_db = lance_db
        self.file_access = file_access
        self.root_path = file_access.root_path
        self.target_directories = target_directories or ['crates', 'apps', 'sources']
        
        logger.info(f"RepoMapGenerator initialized for: {self.target_directories}")
    
    def generate_full_map(self) -> str:
        """
        Generate complete repository map as markdown.
        
        Creates a comprehensive REPO_MAP.md with:
        - Directory structure tree
        - Semantic clusters of related modules
        - Key entry points
        - Generation timestamp
        
        Returns:
            Complete REPO_MAP.md content as markdown string
        
        Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6
        """
        logger.info("Generating full repository map")
        
        sections = []
        
        # Header
        sections.append("# K_OS Repository Map")
        sections.append("")
        sections.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        sections.append("")
        sections.append(
            "This repository map provides a high-level overview of the K_OS codebase structure, "
            "semantic relationships between modules, and key entry points."
        )
        sections.append("")
        
        # Directory Structure
        sections.append("## Directory Structure")
        sections.append("")
        tree_content = self.build_directory_tree()
        sections.append(tree_content)
        sections.append("")
        
        # Key Entry Points
        sections.append("## Key Entry Points")
        sections.append("")
        entry_points = self.identify_entry_points()
        if entry_points:
            for ep in entry_points:
                sections.append(f"- **{ep.name}** ({ep.type}): `{ep.path}`")
                if ep.description:
                    sections.append(f"  - {ep.description}")
        else:
            sections.append("*No entry points identified yet. Run indexing to populate.*")
        sections.append("")
        
        # Semantic Clusters
        sections.append("## Semantic Clusters")
        sections.append("")
        sections.append(
            "Groups of modules with high semantic similarity (similarity > 0.70). "
            "These modules likely work together or serve related purposes."
        )
        sections.append("")
        clusters = self.build_semantic_clusters()
        if clusters:
            for cluster in clusters:
                sections.append(f"### {cluster.name}")
                if cluster.description:
                    sections.append(f"{cluster.description}")
                sections.append("")
                for module in cluster.modules:
                    sections.append(f"- `{module}`")
                sections.append("")
        else:
            sections.append("*No semantic clusters identified yet. Run indexing to populate.*")
            sections.append("")
        
        # Data Flow (placeholder for future enhancement)
        sections.append("## Data Flow")
        sections.append("")
        sections.append(
            "The K_OS architecture follows a data-driven approach with clear separation between "
            "frontend (React + Three.js), backend (Tauri + Rust), and compute (wgpu GPU pipelines)."
        )
        sections.append("")
        sections.append("**High-Level Flow:**")
        sections.append("1. User interacts with React UI (apps/web/src/)")
        sections.append("2. UI invokes Tauri commands via IPC (apps/tauri/)")
        sections.append("3. Tauri backend calls k-os-engine for compute (crates/k-os-engine/)")
        sections.append("4. GPU pipelines process data using wgpu (crates/k-os-engine/src/gpu/)")
        sections.append("5. Results flow back through Tauri to React UI")
        sections.append("")
        
        full_map = "\n".join(sections)
        
        logger.info(f"Generated full repository map: {len(full_map)} chars")
        
        return full_map
    
    def update_incremental(self, changed_files: List[Path]) -> None:
        """
        Update repository map incrementally based on changed files.
        
        This method updates only the affected sections of REPO_MAP.md:
        - If entry points changed, regenerate entry points section
        - If semantic relationships changed, regenerate clusters section
        - If directory structure changed, regenerate tree section
        
        Args:
            changed_files: List of files that changed
        
        Requirement: 33.7
        """
        logger.info(f"Updating repository map incrementally for {len(changed_files)} changed files")
        
        # Read existing REPO_MAP.md
        repo_map_path = self.root_path / "REPO_MAP.md"
        
        if not self.file_access.file_exists(repo_map_path):
            # No existing map, generate full map
            logger.info("No existing REPO_MAP.md, generating full map")
            full_map = self.generate_full_map()
            self.file_access.write_file(repo_map_path, full_map)
            return
        
        try:
            existing_content = self.file_access.read_file(repo_map_path)
        except Exception as e:
            logger.error(f"Failed to read existing REPO_MAP.md: {e}")
            # Regenerate full map on error
            full_map = self.generate_full_map()
            self.file_access.write_file(repo_map_path, full_map)
            return
        
        # Determine which sections need updating
        needs_entry_points_update = any(
            self._is_entry_point_file(f) for f in changed_files
        )
        needs_clusters_update = len(changed_files) > 0  # Any change might affect clusters
        needs_tree_update = any(
            f.name in self.KEY_FILE_PATTERNS for f in changed_files
        )
        
        # If major changes, regenerate full map
        if needs_tree_update or len(changed_files) > 10:
            logger.info("Major changes detected, regenerating full map")
            full_map = self.generate_full_map()
            self.file_access.write_file(repo_map_path, full_map)
            return
        
        # Otherwise, update specific sections
        updated_content = existing_content
        
        if needs_entry_points_update:
            logger.info("Updating entry points section")
            updated_content = self._update_section(
                updated_content,
                "## Key Entry Points",
                self._generate_entry_points_section()
            )
        
        if needs_clusters_update:
            logger.info("Updating semantic clusters section")
            updated_content = self._update_section(
                updated_content,
                "## Semantic Clusters",
                self._generate_clusters_section()
            )
        
        # Update timestamp
        timestamp_line = f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*"
        updated_content = re.sub(
            r'\*Generated:.*?\*',
            timestamp_line,
            updated_content
        )
        
        # Write updated map
        self.file_access.write_file(repo_map_path, updated_content)
        
        logger.info("Repository map updated incrementally")
    
    def build_directory_tree(self) -> str:
        """
        Build hierarchical directory tree with key files.
        
        Creates an ASCII tree representation of the repository structure,
        highlighting key files (main.rs, lib.rs, index.ts, etc.) and
        showing file counts for each directory.
        
        Returns:
            Directory tree as formatted string
        
        Requirement: 33.2
        """
        logger.info("Building directory tree")
        
        lines = []
        
        for target_dir in self.target_directories:
            target_path = self.root_path / target_dir
            
            if not target_path.exists():
                logger.warning(f"Target directory not found: {target_path}")
                continue
            
            # Build tree for this target directory
            lines.append(f"**{target_dir}/**")
            lines.append("")
            
            tree_lines = self._build_tree_recursive(target_path, prefix="", max_depth=3)
            lines.extend(tree_lines)
            lines.append("")
        
        return "\n".join(lines)
    
    def _build_tree_recursive(
        self,
        dir_path: Path,
        prefix: str = "",
        max_depth: int = 3,
        current_depth: int = 0
    ) -> List[str]:
        """
        Recursively build directory tree with ASCII art.
        
        Args:
            dir_path: Directory to process
            prefix: Prefix for tree lines (for indentation)
            max_depth: Maximum depth to traverse
            current_depth: Current depth in recursion
        
        Returns:
            List of formatted tree lines
        """
        if current_depth >= max_depth:
            return []
        
        lines = []
        
        try:
            # Get directory contents
            items = sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name))
            
            # Filter out common noise directories
            items = [
                item for item in items
                if item.name not in {
                    'node_modules', 'target', '.git', '__pycache__',
                    'dist', 'build', '.cache', '.lancedb'
                }
            ]
            
            for i, item in enumerate(items):
                is_last = i == len(items) - 1
                connector = "└── " if is_last else "├── "
                
                if item.is_dir():
                    # Directory
                    file_count = sum(1 for _ in item.rglob('*') if _.is_file())
                    lines.append(f"{prefix}{connector}{item.name}/ ({file_count} files)")
                    
                    # Recurse into subdirectory
                    new_prefix = prefix + ("    " if is_last else "│   ")
                    lines.extend(
                        self._build_tree_recursive(
                            item,
                            new_prefix,
                            max_depth,
                            current_depth + 1
                        )
                    )
                else:
                    # File - only show key files
                    if item.name in self.KEY_FILE_PATTERNS or item.suffix in {'.md', '.toml', '.json'}:
                        lines.append(f"{prefix}{connector}{item.name}")
        
        except PermissionError:
            logger.warning(f"Permission denied: {dir_path}")
        except Exception as e:
            logger.error(f"Error building tree for {dir_path}: {e}")
        
        return lines
    
    def build_semantic_clusters(self) -> List[SemanticCluster]:
        """
        Build semantic clusters using LanceDB similarity.
        
        Groups modules by semantic similarity (threshold > 0.70) to identify
        related functionality. Uses pairwise similarity computation and
        clustering heuristics.
        
        Returns:
            List of SemanticCluster objects
        
        Requirements: 33.4, 34.1
        """
        logger.info("Building semantic clusters")
        
        clusters = []
        
        try:
            # Get all embeddings from LanceDB
            stats = self.lance_db.get_stats()
            total_embeddings = stats.get('total_embeddings', 0)
            
            if total_embeddings == 0:
                logger.warning("No embeddings in database, cannot build clusters")
                return clusters
            
            # Get all file paths and their embeddings
            # Note: This is a simplified approach. For large codebases,
            # we'd want to use more sophisticated clustering algorithms.
            
            # Query LanceDB for all records (limited to avoid memory issues)
            all_records = self._get_all_embeddings(limit=500)
            
            if not all_records:
                logger.warning("No records retrieved from LanceDB")
                return clusters
            
            # Group by file type first (Rust, TypeScript, Python, etc.)
            type_groups: Dict[str, List[Dict]] = {}
            for record in all_records:
                file_type = record.get('file_type', 'unknown')
                if file_type not in type_groups:
                    type_groups[file_type] = []
                type_groups[file_type].append(record)
            
            # Build clusters within each type group
            for file_type, records in type_groups.items():
                if len(records) < 2:
                    continue
                
                # Find highly similar pairs
                similar_groups = self._find_similar_groups(records, threshold=0.70)
                
                for group in similar_groups:
                    cluster_name = self._generate_cluster_name(group, file_type)
                    cluster = SemanticCluster(
                        name=cluster_name,
                        modules=[r['file_path'] for r in group],
                        similarity_threshold=0.70,
                        description=self._generate_cluster_description(group, file_type)
                    )
                    clusters.append(cluster)
            
            logger.info(f"Built {len(clusters)} semantic clusters")
        
        except Exception as e:
            logger.error(f"Failed to build semantic clusters: {e}")
        
        return clusters
    
    def identify_entry_points(self) -> List[EntryPoint]:
        """
        Identify key entry points (main apps, commands, APIs).
        
        Scans the codebase for:
        - React apps (K*.tsx files)
        - Tauri commands (main.rs, commands.rs)
        - API endpoints (api.ts, routes.ts)
        - GPU pipelines (pipeline.rs, .wgsl files)
        
        Returns:
            List of EntryPoint objects
        
        Requirement: 33.5
        """
        logger.info("Identifying entry points")
        
        entry_points = []
        
        for target_dir in self.target_directories:
            target_path = self.root_path / target_dir
            
            if not target_path.exists():
                continue
            
            # Search for entry point patterns
            for ep_type, patterns in self.ENTRY_POINT_PATTERNS.items():
                for pattern in patterns:
                    # Find files matching pattern
                    matches = self._find_files_matching(target_path, pattern)
                    
                    for match in matches:
                        relative_path = match.relative_to(self.root_path)
                        name = self._extract_entry_point_name(match, ep_type)
                        description = self._generate_entry_point_description(match, ep_type)
                        
                        entry_point = EntryPoint(
                            name=name,
                            path=str(relative_path),
                            type=ep_type,
                            description=description
                        )
                        entry_points.append(entry_point)
        
        # Sort by type and name
        entry_points.sort(key=lambda ep: (ep.type, ep.name))
        
        logger.info(f"Identified {len(entry_points)} entry points")
        
        return entry_points
    
    def _get_all_embeddings(self, limit: int = 500) -> List[Dict]:
        """
        Get all embeddings from LanceDB (with limit).
        
        Args:
            limit: Maximum number of records to retrieve
        
        Returns:
            List of embedding records as dictionaries
        """
        try:
            if self.lance_db.table is None:
                return []
            
            # Convert table to pandas and then to dict
            df = self.lance_db.table.to_pandas()
            
            if df.empty:
                return []
            
            # Limit records
            df = df.head(limit)
            
            # Convert to list of dicts
            records = df.to_dict('records')
            
            return records
        
        except Exception as e:
            logger.error(f"Failed to get all embeddings: {e}")
            return []
    
    def _find_similar_groups(
        self,
        records: List[Dict],
        threshold: float = 0.70
    ) -> List[List[Dict]]:
        """
        Find groups of similar records using pairwise similarity.
        
        Args:
            records: List of embedding records
            threshold: Minimum similarity threshold
        
        Returns:
            List of groups (each group is a list of similar records)
        """
        import numpy as np
        
        if len(records) < 2:
            return []
        
        # Extract embeddings
        embeddings = np.array([r['embedding'] for r in records])
        
        # Compute pairwise cosine similarity
        # Normalize embeddings
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized = embeddings / (norms + 1e-8)
        
        # Compute similarity matrix
        similarity_matrix = np.dot(normalized, normalized.T)
        
        # Find groups using simple threshold-based clustering
        groups = []
        used = set()
        
        for i in range(len(records)):
            if i in used:
                continue
            
            # Find all records similar to this one
            similar_indices = np.where(similarity_matrix[i] >= threshold)[0]
            
            if len(similar_indices) > 1:  # At least 2 similar records
                group = [records[j] for j in similar_indices if j not in used]
                
                if len(group) >= 2:
                    groups.append(group)
                    used.update(similar_indices)
        
        return groups
    
    def _generate_cluster_name(self, group: List[Dict], file_type: str) -> str:
        """
        Generate a descriptive name for a semantic cluster.
        
        Args:
            group: List of records in cluster
            file_type: File type of cluster members
        
        Returns:
            Cluster name
        """
        # Extract common path components
        paths = [Path(r['file_path']) for r in group]
        
        # Find common parent directory
        common_parts = []
        if paths:
            parts_list = [p.parts for p in paths]
            min_len = min(len(parts) for parts in parts_list)
            
            for i in range(min_len):
                if all(parts[i] == parts_list[0][i] for parts in parts_list):
                    common_parts.append(parts_list[0][i])
                else:
                    break
        
        if common_parts:
            cluster_name = f"{'/'.join(common_parts[-2:])} ({file_type})"
        else:
            cluster_name = f"{file_type.capitalize()} Modules"
        
        return cluster_name
    
    def _generate_cluster_description(self, group: List[Dict], file_type: str) -> str:
        """
        Generate a description for a semantic cluster.
        
        Args:
            group: List of records in cluster
            file_type: File type of cluster members
        
        Returns:
            Cluster description
        """
        module_names = [r.get('module_name', '') for r in group if r.get('module_name')]
        
        if module_names:
            return f"Related {file_type} modules: {', '.join(module_names[:3])}"
        else:
            return f"Group of {len(group)} semantically related {file_type} files"
    
    def _find_files_matching(self, root: Path, pattern: str) -> List[Path]:
        """
        Find files matching a regex pattern.
        
        Args:
            root: Root directory to search
            pattern: Regex pattern to match
        
        Returns:
            List of matching file paths
        """
        matches = []
        
        try:
            for file_path in root.rglob('*'):
                if file_path.is_file() and re.search(pattern, file_path.name):
                    matches.append(file_path)
        except Exception as e:
            logger.error(f"Error finding files matching {pattern}: {e}")
        
        return matches
    
    def _extract_entry_point_name(self, file_path: Path, ep_type: str) -> str:
        """
        Extract a readable name for an entry point.
        
        Args:
            file_path: Path to entry point file
            ep_type: Entry point type
        
        Returns:
            Entry point name
        """
        if ep_type == 'app':
            # Extract app name from K*.tsx pattern
            name = file_path.stem
            if name.startswith('K'):
                return name[1:]  # Remove 'K' prefix
            return name
        
        elif ep_type == 'command':
            # Use parent directory name for commands
            return file_path.parent.name
        
        elif ep_type == 'api':
            # Use parent directory name for APIs
            return f"{file_path.parent.name} API"
        
        elif ep_type == 'pipeline':
            # Use file name for pipelines
            return file_path.stem
        
        return file_path.stem
    
    def _generate_entry_point_description(self, file_path: Path, ep_type: str) -> str:
        """
        Generate a description for an entry point.
        
        Args:
            file_path: Path to entry point file
            ep_type: Entry point type
        
        Returns:
            Entry point description
        """
        descriptions = {
            'app': "React application entry point",
            'command': "Tauri command handler",
            'api': "API endpoint definition",
            'pipeline': "GPU compute pipeline"
        }
        
        return descriptions.get(ep_type, "Entry point")
    
    def _is_entry_point_file(self, file_path: Path) -> bool:
        """
        Check if a file is an entry point.
        
        Args:
            file_path: Path to check
        
        Returns:
            True if file is an entry point
        """
        for patterns in self.ENTRY_POINT_PATTERNS.values():
            for pattern in patterns:
                if re.search(pattern, file_path.name):
                    return True
        
        return False
    
    def _update_section(self, content: str, section_header: str, new_section: str) -> str:
        """
        Update a specific section in the repository map.
        
        Args:
            content: Full content of REPO_MAP.md
            section_header: Section header to find (e.g., "## Key Entry Points")
            new_section: New section content
        
        Returns:
            Updated content
        """
        # Find section boundaries
        lines = content.split('\n')
        start_idx = -1
        end_idx = -1
        
        for i, line in enumerate(lines):
            if line.strip() == section_header:
                start_idx = i
            elif start_idx >= 0 and line.strip().startswith('##') and i > start_idx:
                end_idx = i
                break
        
        if start_idx < 0:
            # Section not found, append at end
            return content + "\n\n" + new_section
        
        if end_idx < 0:
            # Section is last, replace to end
            end_idx = len(lines)
        
        # Replace section
        new_lines = lines[:start_idx] + [new_section] + lines[end_idx:]
        
        return '\n'.join(new_lines)
    
    def _generate_entry_points_section(self) -> str:
        """Generate the entry points section content."""
        lines = ["## Key Entry Points", ""]
        
        entry_points = self.identify_entry_points()
        if entry_points:
            for ep in entry_points:
                lines.append(f"- **{ep.name}** ({ep.type}): `{ep.path}`")
                if ep.description:
                    lines.append(f"  - {ep.description}")
        else:
            lines.append("*No entry points identified yet. Run indexing to populate.*")
        
        lines.append("")
        return '\n'.join(lines)
    
    def _generate_clusters_section(self) -> str:
        """Generate the semantic clusters section content."""
        lines = [
            "## Semantic Clusters",
            "",
            "Groups of modules with high semantic similarity (similarity > 0.70). "
            "These modules likely work together or serve related purposes.",
            ""
        ]
        
        clusters = self.build_semantic_clusters()
        if clusters:
            for cluster in clusters:
                lines.append(f"### {cluster.name}")
                if cluster.description:
                    lines.append(f"{cluster.description}")
                lines.append("")
                for module in cluster.modules:
                    lines.append(f"- `{module}`")
                lines.append("")
        else:
            lines.append("*No semantic clusters identified yet. Run indexing to populate.*")
            lines.append("")
        
        return '\n'.join(lines)
