"""
Index Update Script for DocGen System

This script provides on-demand indexing of code files with GPU-accelerated embedding generation.
It detects file changes using timestamps and content hashes, generates embeddings in batches,
and updates the LanceDB vector database.

Key Features:
- On-demand execution (no background processes)
- GPU-accelerated embedding generation with CUDA
- Incremental updates (only changed files)
- Full reindex mode for model version changes
- Lightweight and fast (< 10 seconds for 5-10 files)
- Explicit GPU resource management (load on demand, release after completion)
- Repository map update after indexing

Usage:
    python sources/python/DocGen/scripts/update_index.py
    python sources/python/DocGen/scripts/update_index.py --full-reindex
    python sources/python/DocGen/scripts/update_index.py --path crates/k-os-engine

Requirements: 31.2, 31.3, 31.4, 31.7, 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 33.7
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.file_access import SandboxedFileAccess
from core.embedding_engine import EmbeddingEngine
from core.lance_db import LanceDBManager, CodeEmbedding
from core.change_detector import ChangeDetector, ChangeType
from core.repo_map_generator import RepoMapGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
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
    
    logger.info(f"Loaded configuration from {config_path}")
    
    return config


def scan_target_directories(
    file_access: SandboxedFileAccess,
    change_detector: ChangeDetector,
    config: Dict[str, Any],
    target_path: Path = None,
    full_reindex: bool = False
) -> List[Path]:
    """
    Scan target directories for file changes.
    
    Args:
        file_access: Sandboxed file access layer
        change_detector: Change detection system
        config: Configuration dictionary
        target_path: Optional specific path to scan (default: all target directories)
        full_reindex: If True, return all files regardless of changes
    
    Returns:
        List of file paths that need re-indexing
    
    Requirements: 32.1, 32.2
    """
    logger.info("Scanning target directories for changes...")
    
    target_directories = config['indexing']['target_directories']
    file_extensions = config['indexing']['file_extensions']
    excluded_patterns = config['indexing']['excluded_patterns']
    max_file_size_kb = config['indexing']['max_file_size_kb']
    
    changed_files = []
    
    # Determine which directories to scan
    if target_path:
        # Scan specific path
        scan_dirs = [target_path]
    else:
        # Scan all target directories
        scan_dirs = [file_access.root_path / d for d in target_directories]
    
    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            logger.warning(f"Directory not found: {scan_dir}")
            continue
        
        logger.info(f"Scanning: {scan_dir}")
        
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
                        logger.debug(f"Skipping large file: {file_path} ({file_size_kb:.1f} KB)")
                        continue
                except OSError:
                    continue
                
                # Check if file needs re-indexing
                if full_reindex:
                    changed_files.append(file_path)
                else:
                    # Use change detector to check if file changed
                    file_hash = change_detector.compute_file_hash(file_path)
                    file_path_str = str(file_path)
                    
                    cached_entry = change_detector.cache.get(file_path_str, {})
                    cached_hash = cached_entry.get('hash', '')
                    
                    if file_hash != cached_hash:
                        changed_files.append(file_path)
    
    logger.info(f"Found {len(changed_files)} files to index")
    
    return changed_files


def batch_files(files: List[Path], batch_size: int = 32) -> List[List[Path]]:
    """
    Batch files for efficient GPU processing.
    
    Args:
        files: List of file paths
        batch_size: Batch size (default: 32)
    
    Returns:
        List of file batches
    """
    batches = []
    for i in range(0, len(files), batch_size):
        batches.append(files[i:i + batch_size])
    
    return batches


def generate_embeddings(
    files: List[Path],
    file_access: SandboxedFileAccess,
    embedding_engine: EmbeddingEngine,
    change_detector: ChangeDetector
) -> List[CodeEmbedding]:
    """
    Generate embeddings for a list of files.
    
    Args:
        files: List of file paths to embed
        file_access: Sandboxed file access layer
        embedding_engine: Embedding engine
        change_detector: Change detector for hash computation
    
    Returns:
        List of CodeEmbedding objects
    
    Requirements: 22.3, 27.2, 32.3
    """
    logger.info(f"Generating embeddings for {len(files)} files...")
    
    embeddings = []
    
    # Read file contents
    texts = []
    file_metadata = []
    
    for file_path in files:
        try:
            content = file_access.read_file(file_path)
            texts.append(content)
            
            # Compute metadata
            relative_path = file_path.relative_to(file_access.root_path)
            content_hash = change_detector.compute_file_hash(file_path)
            last_modified = file_path.stat().st_mtime
            file_type = file_path.suffix.lstrip('.')
            
            # Extract module name (simple heuristic)
            module_name = extract_module_name(file_path, content)
            
            file_metadata.append({
                'file_path': str(relative_path),
                'content_hash': content_hash,
                'last_modified': last_modified,
                'file_type': file_type,
                'module_name': module_name,
                'chunk_index': 0,
                'metadata': {}
            })
        
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            continue
    
    if not texts:
        logger.warning("No files to embed")
        return embeddings
    
    # Generate embeddings in batch
    try:
        embedding_vectors = embedding_engine.embed_texts(texts)
        
        # Create CodeEmbedding objects
        for i, metadata in enumerate(file_metadata):
            embedding = CodeEmbedding(
                file_path=metadata['file_path'],
                content_hash=metadata['content_hash'],
                last_modified=metadata['last_modified'],
                embedding=embedding_vectors[i],
                file_type=metadata['file_type'],
                module_name=metadata['module_name'],
                chunk_index=metadata['chunk_index'],
                metadata=metadata['metadata']
            )
            embeddings.append(embedding)
        
        logger.info(f"✓ Generated {len(embeddings)} embeddings")
    
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
    
    return embeddings


def extract_module_name(file_path: Path, content: str) -> str:
    """
    Extract module/component name from file.
    
    Simple heuristic: use file name without extension.
    
    Args:
        file_path: Path to file
        content: File content
    
    Returns:
        Module name
    """
    # For now, just use the file stem (name without extension)
    # Future enhancement: parse actual module/class/component names
    return file_path.stem


def update_cache(
    change_detector: ChangeDetector,
    embeddings: List[CodeEmbedding]
) -> None:
    """
    Update change detector cache with new hashes.
    
    Args:
        change_detector: Change detector
        embeddings: List of embeddings that were generated
    """
    for embedding in embeddings:
        file_path = change_detector.cache_dir.parent / embedding.file_path
        change_detector.update_cache(file_path, embedding.content_hash)


def main():
    """
    Main entry point for index update script.
    
    Requirements: 31.2, 32.1, 32.2, 32.7
    """
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description="Update code embeddings index for DocGen system"
    )
    parser.add_argument(
        '--full-reindex',
        action='store_true',
        help='Re-embed all files (use when embedding model changes)'
    )
    parser.add_argument(
        '--path',
        type=str,
        help='Specific directory to index (default: all target directories)'
    )
    
    args = parser.parse_args()
    
    # Start timing
    start_time = time.time()
    
    try:
        # Load configuration
        config = load_config()
        
        # Initialize components
        logger.info("Initializing DocGen components...")
        
        root_path = Path(__file__).parent.parent.parent.parent  # M:\K_OS
        cache_dir = Path(__file__).parent.parent / ".cache"
        db_path = Path(__file__).parent.parent / ".lancedb"
        
        file_access = SandboxedFileAccess(root_path)
        change_detector = ChangeDetector(cache_dir)
        lance_db = LanceDBManager(db_path)
        
        # Initialize embedding engine (GPU will be loaded here)
        logger.info("Loading embedding engine (GPU initialization)...")
        gpu_start_time = time.time()
        
        embedding_engine = EmbeddingEngine(
            model_name=config['embedding']['model'],
            use_gpu=config['embedding']['use_gpu'],
            batch_size=config['embedding']['batch_size']
        )
        
        # Log device info
        device_info = embedding_engine.get_device_info()
        logger.info(f"Device: {device_info['device']}")
        if device_info['device'] == 'cuda':
            logger.info(f"GPU: {device_info.get('gpu_name', 'Unknown')}")
            logger.info(f"GPU Memory: {device_info.get('gpu_memory_gb', 0):.2f} GB")
        
        # Scan for changed files
        target_path = Path(args.path) if args.path else None
        changed_files = scan_target_directories(
            file_access,
            change_detector,
            config,
            target_path,
            args.full_reindex
        )
        
        if not changed_files:
            logger.info("No files to index. Index is up to date.")
            embedding_engine.release_gpu()
            return
        
        # Batch files for GPU processing
        batches = batch_files(changed_files, config['embedding']['batch_size'])
        logger.info(f"Processing {len(batches)} batches...")
        
        all_embeddings = []
        
        # Process each batch
        for i, batch in enumerate(batches):
            logger.info(f"Processing batch {i+1}/{len(batches)} ({len(batch)} files)...")
            
            batch_embeddings = generate_embeddings(
                batch,
                file_access,
                embedding_engine,
                change_detector
            )
            
            all_embeddings.extend(batch_embeddings)
        
        # Upsert embeddings to LanceDB
        if all_embeddings:
            logger.info(f"Upserting {len(all_embeddings)} embeddings to LanceDB...")
            lance_db.upsert_embeddings(all_embeddings)
            
            # Update cache
            update_cache(change_detector, all_embeddings)
            
            logger.info("✓ Embeddings upserted successfully")
        
        # Calculate GPU time
        gpu_time = time.time() - gpu_start_time
        
        # Release GPU resources
        logger.info("Releasing GPU resources...")
        embedding_engine.release_gpu()
        logger.info("✓ GPU resources released")
        
        # Update repository map
        logger.info("Updating repository map...")
        repo_map_generator = RepoMapGenerator(
            lance_db,
            file_access,
            config['indexing']['target_directories']
        )
        repo_map_generator.update_incremental(changed_files)
        logger.info("✓ Repository map updated")
        
        # Calculate total time
        total_time = time.time() - start_time
        
        # Log performance metrics
        logger.info("")
        logger.info("=" * 60)
        logger.info("INDEXING COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Files scanned: {len(changed_files)}")
        logger.info(f"Files changed: {len(changed_files)}")
        logger.info(f"Embeddings generated: {len(all_embeddings)}")
        logger.info(f"GPU time: {gpu_time:.2f}s")
        logger.info(f"Total time: {total_time:.2f}s")
        logger.info("=" * 60)
        
        # Verify performance target (< 10 seconds for 5-10 files)
        if 5 <= len(changed_files) <= 10:
            if total_time < 10:
                logger.info("✓ Performance target met (< 10s for 5-10 files)")
            else:
                logger.warning(f"⚠ Performance target missed: {total_time:.2f}s > 10s")
    
    except KeyboardInterrupt:
        logger.info("\nIndexing interrupted by user")
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"Indexing failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
