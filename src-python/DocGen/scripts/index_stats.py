#!/usr/bin/env python3
"""
Index Statistics Script for DocGen System

This script provides health monitoring for the vector database. It queries LanceDB
for statistics, detects stale files (modified but not re-indexed), calculates semantic
coverage, and formats output as a terminal table or JSON.

Key Features:
- Query LanceDB for total embeddings and index size
- Detect stale files by comparing file modification times with indexed timestamps
- Calculate semantic coverage (% of codebase indexed)
- Format output as readable terminal table
- Support --json flag for machine-readable output
- Lightweight and fast (no GPU resources required)

Usage:
    python src-python/DocGen/scripts/index_stats.py
    python src-python/DocGen/scripts/index_stats.py --json
    python src-python/DocGen/scripts/index_stats.py --path crates/k-os-engine

Requirements: 31.2
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import directly from module files to avoid core/__init__.py which imports EmbeddingEngine
from core.file_access import SandboxedFileAccess
from core.lance_db import LanceDBManager
from core.change_detector import ChangeDetector

# Configure logging
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings/errors by default
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_config() -> Dict[str, Any]:
    """
    Load configuration from docgen_config.json.
    
    Returns:
        Configuration dictionary
    
    Raises:
        FileNotFoundError: If config file not found
        json.JSONDecodeError: If config file is invalid
    """
    config_path = Path(__file__).parent.parent / "docgen_config.json"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    return config


def get_database_stats(lance_db: LanceDBManager) -> Dict[str, Any]:
    """
    Query LanceDB for database statistics.
    
    Args:
        lance_db: LanceDB manager instance
    
    Returns:
        Dictionary with database statistics:
            - total_embeddings: Total number of embeddings
            - index_size_mb: Database size in MB
            - file_types: Count of embeddings by file type
            - db_path: Path to database directory
    
    Requirement: 31.2
    """
    logger.info("Querying LanceDB for statistics...")
    
    stats = lance_db.get_stats()
    
    return stats


def detect_stale_files(
    file_access: SandboxedFileAccess,
    lance_db: LanceDBManager,
    change_detector: ChangeDetector,
    config: Dict[str, Any],
    target_path: Path = None
) -> List[Tuple[Path, float, float]]:
    """
    Detect stale files (modified but not re-indexed).
    
    Compares file modification times with indexed timestamps to identify
    files that have been modified since they were last indexed.
    
    Args:
        file_access: Sandboxed file access layer
        lance_db: LanceDB manager instance
        change_detector: Change detector for hash computation
        config: Configuration dictionary
        target_path: Optional specific path to check (default: all target directories)
    
    Returns:
        List of tuples: (file_path, file_mtime, indexed_mtime)
        where file_mtime > indexed_mtime
    
    Requirement: 31.2
    """
    logger.info("Detecting stale files...")
    
    target_directories = config['indexing']['target_directories']
    file_extensions = config['indexing']['file_extensions']
    excluded_patterns = config['indexing']['excluded_patterns']
    max_file_size_kb = config['indexing']['max_file_size_kb']
    
    stale_files = []
    
    # Determine which directories to scan
    if target_path:
        scan_dirs = [target_path]
    else:
        scan_dirs = [file_access.root_path / d for d in target_directories]
    
    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            logger.warning(f"Directory not found: {scan_dir}")
            continue
        
        # Recursively find all code files
        for ext in file_extensions:
            for file_path in scan_dir.rglob(f'*{ext}'):
                # Skip excluded patterns
                if any(file_path.match(pattern) for pattern in excluded_patterns):
                    continue
                
                # Skip files that are too large
                try:
                    file_size_kb = file_path.stat().st_size / 1024
                    if file_size_kb > max_file_size_kb:
                        continue
                except OSError:
                    continue
                
                # Get file modification time
                try:
                    file_mtime = file_path.stat().st_mtime
                except OSError:
                    continue
                
                # Get indexed timestamp from LanceDB
                relative_path = str(file_path.relative_to(file_access.root_path))
                embedding = lance_db.get_by_path(relative_path)
                
                if embedding is None:
                    # File not indexed at all
                    stale_files.append((file_path, file_mtime, 0.0))
                elif file_mtime > embedding.last_modified:
                    # File modified after indexing
                    stale_files.append((file_path, file_mtime, embedding.last_modified))
    
    logger.info(f"Found {len(stale_files)} stale files")
    
    return stale_files


def calculate_semantic_coverage(
    file_access: SandboxedFileAccess,
    lance_db: LanceDBManager,
    config: Dict[str, Any],
    target_path: Path = None
) -> Dict[str, Any]:
    """
    Calculate semantic coverage (% of codebase indexed).
    
    Compares the number of indexed files against the total number of
    code files in the target directories.
    
    Args:
        file_access: Sandboxed file access layer
        lance_db: LanceDB manager instance
        config: Configuration dictionary
        target_path: Optional specific path to check (default: all target directories)
    
    Returns:
        Dictionary with coverage statistics:
            - total_files: Total number of code files
            - indexed_files: Number of files with embeddings
            - coverage_percent: Percentage of files indexed
            - unindexed_files: Number of files not indexed
    
    Requirement: 31.2
    """
    logger.info("Calculating semantic coverage...")
    
    target_directories = config['indexing']['target_directories']
    file_extensions = config['indexing']['file_extensions']
    excluded_patterns = config['indexing']['excluded_patterns']
    max_file_size_kb = config['indexing']['max_file_size_kb']
    
    total_files = 0
    indexed_files = 0
    
    # Determine which directories to scan
    if target_path:
        scan_dirs = [target_path]
    else:
        scan_dirs = [file_access.root_path / d for d in target_directories]
    
    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            logger.warning(f"Directory not found: {scan_dir}")
            continue
        
        # Recursively find all code files
        for ext in file_extensions:
            for file_path in scan_dir.rglob(f'*{ext}'):
                # Skip excluded patterns
                if any(file_path.match(pattern) for pattern in excluded_patterns):
                    continue
                
                # Skip files that are too large
                try:
                    file_size_kb = file_path.stat().st_size / 1024
                    if file_size_kb > max_file_size_kb:
                        continue
                except OSError:
                    continue
                
                total_files += 1
                
                # Check if file is indexed
                relative_path = str(file_path.relative_to(file_access.root_path))
                embedding = lance_db.get_by_path(relative_path)
                
                if embedding is not None:
                    indexed_files += 1
    
    # Calculate coverage percentage
    coverage_percent = (indexed_files / total_files * 100) if total_files > 0 else 0.0
    unindexed_files = total_files - indexed_files
    
    coverage = {
        'total_files': total_files,
        'indexed_files': indexed_files,
        'unindexed_files': unindexed_files,
        'coverage_percent': coverage_percent
    }
    
    logger.info(f"Coverage: {indexed_files}/{total_files} files ({coverage_percent:.1f}%)")
    
    return coverage


def format_table_output(
    db_stats: Dict[str, Any],
    stale_files: List[Tuple[Path, float, float]],
    coverage: Dict[str, Any]
) -> str:
    """
    Format statistics as a readable terminal table.
    
    Args:
        db_stats: Database statistics
        stale_files: List of stale files
        coverage: Coverage statistics
    
    Returns:
        Formatted table string
    
    Requirement: 31.2
    """
    lines = []
    
    # Header
    lines.append("=" * 70)
    lines.append("INDEX HEALTH STATISTICS")
    lines.append("=" * 70)
    lines.append("")
    
    # Database Statistics
    lines.append("DATABASE STATISTICS")
    lines.append("-" * 70)
    lines.append(f"  Total Embeddings:     {db_stats['total_embeddings']:,}")
    lines.append(f"  Index Size:           {db_stats['index_size_mb']:.2f} MB")
    lines.append(f"  Database Path:        {db_stats['db_path']}")
    lines.append("")
    
    # File Type Distribution
    if db_stats.get('file_types'):
        lines.append("  File Type Distribution:")
        for file_type, count in sorted(db_stats['file_types'].items(), key=lambda x: x[1], reverse=True):
            lines.append(f"    {file_type:10s}  {count:,} files")
        lines.append("")
    
    # Semantic Coverage
    lines.append("SEMANTIC COVERAGE")
    lines.append("-" * 70)
    lines.append(f"  Total Code Files:     {coverage['total_files']:,}")
    lines.append(f"  Indexed Files:        {coverage['indexed_files']:,}")
    lines.append(f"  Unindexed Files:      {coverage['unindexed_files']:,}")
    lines.append(f"  Coverage:             {coverage['coverage_percent']:.1f}%")
    lines.append("")
    
    # Progress bar for coverage
    bar_width = 50
    filled = int(bar_width * coverage['coverage_percent'] / 100)
    bar = "█" * filled + "░" * (bar_width - filled)
    lines.append(f"  [{bar}] {coverage['coverage_percent']:.1f}%")
    lines.append("")
    
    # Stale Files
    lines.append("STALE FILES (Modified but not re-indexed)")
    lines.append("-" * 70)
    
    if not stale_files:
        lines.append("  ✓ No stale files detected. Index is up to date.")
    else:
        lines.append(f"  ⚠ Found {len(stale_files)} stale files:")
        lines.append("")
        
        # Show first 10 stale files
        for i, (file_path, file_mtime, indexed_mtime) in enumerate(stale_files[:10]):
            if indexed_mtime == 0.0:
                status = "NOT INDEXED"
            else:
                age_seconds = file_mtime - indexed_mtime
                age_hours = age_seconds / 3600
                if age_hours < 1:
                    age_str = f"{age_seconds / 60:.0f}m old"
                elif age_hours < 24:
                    age_str = f"{age_hours:.1f}h old"
                else:
                    age_str = f"{age_hours / 24:.1f}d old"
                status = f"STALE ({age_str})"
            
            lines.append(f"    {i+1:2d}. {file_path.name:40s} [{status}]")
        
        if len(stale_files) > 10:
            lines.append(f"    ... and {len(stale_files) - 10} more")
        
        lines.append("")
        lines.append("  Run 'python scripts/update_index.py' to update stale files.")
    
    lines.append("")
    lines.append("=" * 70)
    
    return "\n".join(lines)


def format_json_output(
    db_stats: Dict[str, Any],
    stale_files: List[Tuple[Path, float, float]],
    coverage: Dict[str, Any]
) -> str:
    """
    Format statistics as JSON for programmatic access.
    
    Args:
        db_stats: Database statistics
        stale_files: List of stale files
        coverage: Coverage statistics
    
    Returns:
        JSON string
    
    Requirement: 31.2
    """
    # Convert stale files to serializable format
    stale_files_data = []
    for file_path, file_mtime, indexed_mtime in stale_files:
        stale_files_data.append({
            'file_path': str(file_path),
            'file_mtime': file_mtime,
            'indexed_mtime': indexed_mtime,
            'age_seconds': file_mtime - indexed_mtime if indexed_mtime > 0 else None
        })
    
    output = {
        'database': db_stats,
        'coverage': coverage,
        'stale_files': {
            'count': len(stale_files),
            'files': stale_files_data
        },
        'timestamp': time.time()
    }
    
    return json.dumps(output, indent=2)


def main():
    """
    Main entry point for index statistics script.
    
    Requirement: 31.2
    """
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description="Display index health statistics for DocGen system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Display statistics as terminal table
  python scripts/index_stats.py
  
  # Output statistics as JSON
  python scripts/index_stats.py --json
  
  # Check statistics for specific directory
  python scripts/index_stats.py --path crates/k-os-engine
        """
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output statistics as JSON for programmatic access'
    )
    parser.add_argument(
        '--path',
        type=str,
        help='Specific directory to check (default: all target directories)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Enable verbose logging if requested
    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)
    
    try:
        # Load configuration
        config = load_config()
        
        # Initialize components
        root_path = Path(__file__).parent.parent.parent.parent  # M:\\K_OS
        cache_dir = Path(__file__).parent.parent / ".cache"
        db_path = Path(__file__).parent.parent / ".lancedb"
        
        file_access = SandboxedFileAccess(root_path)
        change_detector = ChangeDetector(cache_dir)
        lance_db = LanceDBManager(db_path)
        
        # Get target path if specified
        target_path = Path(args.path) if args.path else None
        if target_path and not target_path.is_absolute():
            target_path = root_path / target_path
        
        # Query database statistics
        db_stats = get_database_stats(lance_db)
        
        # Detect stale files
        stale_files = detect_stale_files(
            file_access,
            lance_db,
            change_detector,
            config,
            target_path
        )
        
        # Calculate semantic coverage
        coverage = calculate_semantic_coverage(
            file_access,
            lance_db,
            config,
            target_path
        )
        
        # Format and output results
        if args.json:
            output = format_json_output(db_stats, stale_files, coverage)
            print(output)
        else:
            output = format_table_output(db_stats, stale_files, coverage)
            print(output)
    
    except KeyboardInterrupt:
        print("\nInterrupted by user", file=sys.stderr)
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"Failed to retrieve index statistics: {e}", exc_info=True)
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
