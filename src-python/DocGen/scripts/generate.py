#!/usr/bin/env python3
"""
README Generation CLI Script

This is the main entry point for the Automated README Generation System.
It orchestrates LLM-powered README generation across the K_OS codebase.

Usage:
    python src-python/DocGen/scripts/generate.py
    python src-python/DocGen/scripts/generate.py --path crates/k-os-engine
    python src-python/DocGen/scripts/generate.py --dry-run --provider gemini
    python src-python/DocGen/scripts/generate.py --watch --concurrency 5
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

# Load environment variables from .env.local
try:
    from dotenv import load_dotenv
    # Load from current directory first, then parent
    env_file = Path(__file__).parent / '.env.local'
    if env_file.exists():
        load_dotenv(env_file)
    else:
        # Try parent directory
        env_file = Path(__file__).parent.parent / '.env.local'
        if env_file.exists():
            load_dotenv(env_file)
except ImportError:
    pass  # dotenv not available, skip

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core import (
    SandboxedFileAccess,
    LLMClient,
    LanceDBManager,
    ChangeDetector,
    SecurityError,
    CostTracker
)
from core.readme_generator import READMEGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """Result of README generation for a single directory."""
    dir_path: Path
    success: bool
    error: Optional[str] = None
    cost_usd: float = 0.0
    readme_path: Optional[Path] = None
    skipped: bool = False
    skip_reason: Optional[str] = None


async def process_directory(
    dir_path: Path,
    readme_generator,
    file_access,
    change_detector,
    cost_tracker,
    semaphore: asyncio.Semaphore,
    rate_limit_delay: float,
    force: bool = False,
    review_mode: bool = False
) -> GenerationResult:
    """
    Process a single directory to generate README.
    
    Uses change detection to determine if README regeneration is needed.
    Skips directories with only cosmetic changes unless force=True.
    Tracks costs and enforces budget limits.
    In review mode, prompts user for approval before writing.
    
    Args:
        dir_path: Directory to process
        readme_generator: READMEGenerator instance
        file_access: SandboxedFileAccess instance
        change_detector: ChangeDetector instance
        cost_tracker: CostTracker instance for budget enforcement
        semaphore: Asyncio semaphore for concurrency control
        rate_limit_delay: Delay in seconds between requests
        force: Force regeneration bypassing change detection
        review_mode: Display content and prompt for approval before writing
    
    Returns:
        GenerationResult with processing outcome
    
    Requirements: 18.1, 18.2, 18.3, 19.1, 19.4, 20.1, 20.2, 20.3, 20.4, 20.5, 23.5, 23.6
    """
    async with semaphore:
        try:
            logger.info(f"Processing: {dir_path}")
            
            # Change detection (unless force flag is set)
            if not force:
                from core.change_detector import ChangeType
                
                # Scan directory for changes
                change_report = change_detector.scan_directory(dir_path)
                
                # Check if there are any changes
                has_changes = (
                    len(change_report.added_files) > 0 or
                    len(change_report.modified_files) > 0 or
                    len(change_report.deleted_files) > 0
                )
                
                if not has_changes:
                    logger.info(f"⊘ Skipping {dir_path}: No changes detected")
                    return GenerationResult(
                        dir_path=dir_path,
                        success=True,
                        skipped=True,
                        skip_reason="no_changes"
                    )
                
                # Check if only cosmetic changes (Requirement 23.5)
                only_cosmetic = True
                for file_path, change_type in change_report.change_classifications.items():
                    if change_type in (ChangeType.STRUCTURAL, ChangeType.BEHAVIORAL):
                        only_cosmetic = False
                        break
                
                # Skip if only cosmetic changes and no added/deleted files (Requirement 23.6)
                if only_cosmetic and len(change_report.added_files) == 0 and len(change_report.deleted_files) == 0:
                    logger.info(f"⊘ Skipping {dir_path}: Only cosmetic changes detected")
                    return GenerationResult(
                        dir_path=dir_path,
                        success=True,
                        skipped=True,
                        skip_reason="cosmetic_only"
                    )
                
                # Log change summary (Requirement 23.7)
                logger.info(f"Changes detected in {dir_path}:")
                if change_report.added_files:
                    logger.info(f"  Added: {len(change_report.added_files)} files")
                if change_report.modified_files:
                    structural = sum(1 for f, t in change_report.change_classifications.items() if t == ChangeType.STRUCTURAL)
                    behavioral = sum(1 for f, t in change_report.change_classifications.items() if t == ChangeType.BEHAVIORAL)
                    cosmetic = sum(1 for f, t in change_report.change_classifications.items() if t == ChangeType.COSMETIC)
                    logger.info(f"  Modified: {len(change_report.modified_files)} files (structural: {structural}, behavioral: {behavioral}, cosmetic: {cosmetic})")
                if change_report.deleted_files:
                    logger.info(f"  Deleted: {len(change_report.deleted_files)} files")
            else:
                logger.info(f"Force mode: Bypassing change detection for {dir_path}")
            
            # Generate README
            readme_content = await readme_generator.generate_readme(dir_path)
            
            # Get cost from last LLM response
            cost = 0.0
            if hasattr(readme_generator.llm_client, '_last_response_cost'):
                cost = readme_generator.llm_client._last_response_cost
            
            # Check budget limit before writing (Requirement 19.4)
            if not cost_tracker.add_cost(cost):
                logger.error(f"✗ Budget limit reached! Stopping processing.")
                return GenerationResult(
                    dir_path=dir_path,
                    success=False,
                    error="Budget limit exceeded",
                    cost_usd=cost
                )
            
            # Review mode: Display content and prompt for approval (Requirements 20.1, 20.2, 20.3, 20.4, 20.5)
            readme_path = dir_path / "README.md"
            final_content = readme_content
            
            if review_mode:
                should_write, edited_content = await review_readme_content(
                    dir_path=dir_path,
                    readme_content=readme_content,
                    readme_path=readme_path
                )
                
                if not should_write:
                    # User rejected - skip writing (Requirement 20.4)
                    logger.info(f"⊘ Skipped {dir_path}: User rejected in review mode")
                    return GenerationResult(
                        dir_path=dir_path,
                        success=True,
                        skipped=True,
                        skip_reason="user_rejected",
                        cost_usd=cost
                    )
                
                # User approved or edited - use final content (Requirement 20.5, 20.6)
                final_content = edited_content
            
            # Write README
            file_access.write_file(readme_path, final_content)
            
            # Update tracker counts
            cost_tracker.increment_directories()
            cost_tracker.increment_readmes()
            
            logger.info(f"✓ Generated README: {readme_path} (cost: ${cost:.4f})")
            
            # Update cache after successful generation (Requirement 18.3)
            if not force:
                # Re-scan to update cache with final state
                change_detector.scan_directory(dir_path)
            
            # Rate limiting delay
            if rate_limit_delay > 0:
                await asyncio.sleep(rate_limit_delay)
            
            return GenerationResult(
                dir_path=dir_path,
                success=True,
                cost_usd=cost,
                readme_path=readme_path
            )
        
        except Exception as e:
            logger.error(f"✗ Failed to process {dir_path}: {e}")
            return GenerationResult(
                dir_path=dir_path,
                success=False,
                error=str(e)
            )
async def review_readme_content(
    dir_path: Path,
    readme_content: str,
    readme_path: Path
) -> tuple[bool, Optional[str]]:
    """
    Display README content and prompt user for approval.

    Provides three options:
    - approve: Write the README as-is
    - reject: Skip writing this README
    - edit: Allow inline editing before writing

    Args:
        dir_path: Directory being documented
        readme_content: Generated README content
        readme_path: Path where README will be written

    Returns:
        Tuple of (should_write, final_content)
        - should_write: True if README should be written, False if rejected
        - final_content: Final content to write (may be edited), or None if rejected

    Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
    """
    print("\n" + "="*80)
    print(f"REVIEW MODE: {dir_path}")
    print("="*80)
    print("\nGenerated README content:")
    print("-"*80)
    print(readme_content)
    print("-"*80)
    print(f"\nREADME will be written to: {readme_path}")
    print("\nOptions:")
    print("  [a] approve  - Write README as shown")
    print("  [r] reject   - Skip writing this README")
    print("  [e] edit     - Edit content before writing")
    print()

    while True:
        try:
            choice = input("Your choice [a/r/e]: ").strip().lower()

            if choice in ['a', 'approve']:
                logger.info(f"User approved README for {dir_path}")
                return True, readme_content

            elif choice in ['r', 'reject']:
                logger.info(f"User rejected README for {dir_path}")
                return False, None

            elif choice in ['e', 'edit']:
                logger.info(f"User requested edit for {dir_path}")
                print("\nEnter edited content (press Ctrl+D or Ctrl+Z when done):")
                print("(Original content is shown above for reference)")
                print("-"*80)

                # Read multi-line input
                import sys
                edited_lines = []
                try:
                    while True:
                        line = input()
                        edited_lines.append(line)
                except EOFError:
                    pass

                edited_content = '\n'.join(edited_lines).strip()

                if not edited_content:
                    print("\nNo content entered. Returning to options...")
                    continue

                # Show edited content and confirm
                print("\n" + "-"*80)
                print("Edited content:")
                print("-"*80)
                print(edited_content)
                print("-"*80)

                confirm = input("\nWrite this content? [y/n]: ").strip().lower()
                if confirm in ['y', 'yes']:
                    logger.info(f"User confirmed edited README for {dir_path}")
                    return True, edited_content
                else:
                    print("\nEdit cancelled. Returning to options...")
                    continue

            else:
                print(f"Invalid choice: '{choice}'. Please enter 'a', 'r', or 'e'.")

        except KeyboardInterrupt:
            print("\n\nReview interrupted. Treating as reject.")
            logger.info(f"Review interrupted for {dir_path}, treating as reject")
            return False, None
        except Exception as e:
            logger.error(f"Error during review: {e}")
            print(f"\nError during review: {e}")
            print("Treating as reject to be safe.")
            return False, None





async def process_directories_parallel(
    directories: List[Path],
    readme_generator,
    file_access,
    change_detector,
    cost_tracker,
    max_concurrency: int,
    rate_limit_delay: float,
    force: bool = False,
    review_mode: bool = False
) -> List[GenerationResult]:
    """
    Process multiple directories in parallel with concurrency control.
    
    Args:
        directories: List of directories to process
        readme_generator: READMEGenerator instance
        file_access: SandboxedFileAccess instance
        change_detector: ChangeDetector instance
        cost_tracker: CostTracker instance for budget enforcement
        max_concurrency: Maximum number of concurrent requests
        rate_limit_delay: Delay in seconds between requests (rate limiting)
        force: Force regeneration bypassing change detection
        review_mode: Display content and prompt for approval before writing
    
    Returns:
        List of GenerationResult objects
    
    Requirements: 17.1, 17.2, 17.3, 17.4, 19.1, 19.4, 20.1
    """
    logger.info(f"Starting parallel processing with concurrency={max_concurrency}")
    
    # In review mode, force sequential processing (concurrency=1) for interactive prompts
    if review_mode:
        logger.info("Review mode enabled: Processing directories sequentially")
        max_concurrency = 1
    
    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(max_concurrency)
    
    # Create tasks for all directories
    tasks = [
        process_directory(
            dir_path=dir_path,
            readme_generator=readme_generator,
            file_access=file_access,
            change_detector=change_detector,
            cost_tracker=cost_tracker,
            semaphore=semaphore,
            rate_limit_delay=rate_limit_delay,
            force=force,
            review_mode=review_mode
        )
        for dir_path in directories
    ]
    
    # Execute all tasks concurrently
    results = await asyncio.gather(*tasks, return_exceptions=False)
    
    return results


def aggregate_results(results: List[GenerationResult]) -> Dict[str, Any]:
    """
    Aggregate results from parallel processing.
    
    Args:
        results: List of GenerationResult objects
    
    Returns:
        Dictionary with aggregated statistics
    
    Requirements: 17.5
    """
    total = len(results)
    successful = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success and not r.skipped)
    skipped = sum(1 for r in results if r.skipped)
    total_cost = sum(r.cost_usd for r in results)
    
    return {
        'total': total,
        'successful': successful,
        'failed': failed,
        'skipped': skipped,
        'total_cost_usd': total_cost,
        'failed_dirs': [str(r.dir_path) for r in results if not r.success and not r.skipped]
    }


def report_progress(results: List[GenerationResult], start_time: float):
    """
    Report progress and final statistics.
    
    Args:
        results: List of GenerationResult objects
        start_time: Start time (from time.time())
    
    Requirements: 17.6
    """
    stats = aggregate_results(results)
    elapsed = time.time() - start_time
    
    logger.info("\n" + "="*60)
    logger.info("README GENERATION COMPLETE")
    logger.info("="*60)
    logger.info(f"Total directories:    {stats['total']}")
    logger.info(f"Successfully created: {stats['successful']}")
    logger.info(f"Failed:               {stats['failed']}")
    logger.info(f"Skipped:              {stats['skipped']}")
    logger.info(f"Total cost:           ${stats['total_cost_usd']:.4f}")
    logger.info(f"Time elapsed:         {elapsed:.2f}s")
    
    if stats['failed'] > 0:
        logger.warning("\nFailed directories:")
        for dir_path in stats['failed_dirs']:
            logger.warning(f"  - {dir_path}")
    
    logger.info("="*60 + "\n")


def parse_arguments() -> argparse.Namespace:
    """
    Parse command-line arguments.
    
    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description='Generate README.md files across the K_OS codebase using AI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate READMEs for all target directories
  python scripts/generate.py
  
  # Generate READMEs for specific directory
  python scripts/generate.py --path crates/k-os-engine
  
  # Dry run (no API calls, no file writes)
  python scripts/generate.py --dry-run
  
  # Use Gemini instead of OpenRouter
  python scripts/generate.py --provider gemini --model gemini-pro
  
  # Review mode (approve each README before writing)
  python scripts/generate.py --review-mode
  
  # Watch mode (auto-regenerate on file changes)
  python scripts/generate.py --watch
  
  # Force regeneration (bypass cache)
  python scripts/generate.py --force
  
  # Limit concurrent API requests
  python scripts/generate.py --concurrency 3
  
  # Set maximum cost limit
  python scripts/generate.py --max-cost 5.0
        """
    )
    
    # Target directory
    parser.add_argument(
        '--path',
        type=str,
        default=None,
        help='Target directory to process (relative to K_OS root). If not specified, processes all target directories.'
    )
    
    # LLM provider and model
    parser.add_argument(
        '--provider',
        type=str,
        choices=['openrouter', 'gemini'],
        default=None,
        help='LLM provider to use (default: from config file)'
    )
    
    parser.add_argument(
        '--model',
        type=str,
        default=None,
        help='LLM model to use (default: from config file)'
    )
    
    # Execution modes
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be generated without making API calls or writing files'
    )
    
    parser.add_argument(
        '--review-mode',
        action='store_true',
        help='Display generated content and prompt for approval before writing'
    )
    
    parser.add_argument(
        '--watch',
        action='store_true',
        help='Watch for file changes and auto-regenerate READMEs'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force regeneration of all READMEs, bypassing cache and change detection'
    )
    
    # Performance and cost controls
    parser.add_argument(
        '--concurrency',
        type=int,
        default=None,
        help='Maximum number of concurrent API requests (default: from config file)'
    )
    
    parser.add_argument(
        '--max-cost',
        type=float,
        default=None,
        help='Maximum cost in USD for this run (default: from config file)'
    )
    
    return parser.parse_args()


def load_config(config_path: Path) -> dict:
    """
    Load configuration from docgen_config.json.
    
    Args:
        config_path: Path to config file
    
    Returns:
        Configuration dictionary
    
    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If config file is invalid JSON
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    logger.info(f"Loaded configuration from {config_path}")
    return config


def get_target_directories(root_path: Path, config: dict, specific_path: Optional[str] = None) -> List[Path]:
    """
    Get list of target directories to process.
    
    Args:
        root_path: K_OS root directory
        config: Configuration dictionary
        specific_path: Optional specific path to process
    
    Returns:
        List of directory paths to process
    """
    if specific_path:
        # Process specific directory
        target = root_path / specific_path
        if not target.exists():
            raise ValueError(f"Target directory does not exist: {target}")
        if not target.is_dir():
            raise ValueError(f"Target path is not a directory: {target}")
        
        logger.info(f"Processing specific directory: {target}")
        return [target]
    
    # Process all target directories from config
    target_dirs = config.get('indexing', {}).get('target_directories', ['crates', 'src-frontend', 'src-tauri'])
    
    directories = []
    for target_dir in target_dirs:
        dir_path = root_path / target_dir
        if dir_path.exists() and dir_path.is_dir():
            directories.append(dir_path)
            logger.info(f"Added target directory: {dir_path}")
        else:
            logger.warning(f"Target directory not found, skipping: {dir_path}")
    
    return directories


def traverse_directory(directory: Path, file_access: SandboxedFileAccess, config: dict) -> List[Path]:
    """
    Traverse a directory and return subdirectories that need READMEs.
    
    Filters out:
    - Empty directories
    - Directories without code files
    - Excluded patterns (node_modules, target, .git, etc.)
    
    Args:
        directory: Directory to traverse
        file_access: Sandboxed file access instance
        config: Configuration dictionary
    
    Returns:
        List of subdirectories that need README generation
    """
    excluded_patterns = config.get('indexing', {}).get('excluded_patterns', [])
    file_extensions = config.get('indexing', {}).get('file_extensions', ['.rs', '.ts', '.tsx', '.py', '.wgsl', '.json'])
    
    target_dirs = []
    
    try:
        # Get all subdirectories recursively
        for item in directory.rglob('*'):
            if not item.is_dir():
                continue
            
            # Check if directory matches excluded patterns
            relative_path = item.relative_to(directory)
            path_str = str(relative_path).replace('\\', '/')
            
            # Skip excluded patterns
            skip = False
            for pattern in excluded_patterns:
                # Simple pattern matching (supports **)
                pattern_clean = pattern.replace('**/', '').replace('/**', '').replace('*', '')
                if pattern_clean in path_str:
                    skip = True
                    break
            
            if skip:
                logger.debug(f"Skipping excluded directory: {item}")
                continue
            
            # Check if directory contains code files
            has_code_files = False
            try:
                for file in item.iterdir():
                    if file.is_file() and file.suffix in file_extensions:
                        has_code_files = True
                        break
            except PermissionError:
                logger.warning(f"Permission denied accessing directory: {item}")
                continue
            
            if has_code_files:
                target_dirs.append(item)
                logger.debug(f"Found target directory: {item}")
            else:
                logger.debug(f"Skipping directory without code files: {item}")
    
    except Exception as e:
        logger.error(f"Error traversing directory {directory}: {e}")
    
    return sorted(target_dirs)


def initialize_services(root_path: Path, config: dict, args: argparse.Namespace):
    """
    Initialize all core services.
    
    Args:
        root_path: K_OS root directory
        config: Configuration dictionary
        args: Parsed command-line arguments
    
    Returns:
        Tuple of (file_access, llm_client, lance_db, change_detector, readme_generator)
    """
    logger.info("Initializing services...")
    
    # Initialize sandboxed file access
    file_access = SandboxedFileAccess(root_path=root_path, allowed_write_extensions=['.md'])
    logger.info("✓ Sandboxed file access initialized")
    
    # Initialize LLM client
    provider = args.provider or config['llm']['provider']
    model = args.model or config['llm']['model']
    api_key_env = config['llm']['api_key_env']
    
    import os
    api_key = os.getenv(api_key_env)
    if not api_key:
        logger.warning(f"API key not found in environment variable: {api_key_env}")
        if not args.dry_run:
            raise ValueError(f"API key required for {provider}. Set {api_key_env} environment variable.")
    
    llm_client = LLMClient(
        provider=provider,
        model=model,
        api_key=api_key or "dummy-key-for-dry-run"
    )
    logger.info(f"✓ LLM client initialized (provider={provider}, model={model})")
    
    # Initialize LanceDB
    lance_db_path = root_path / "src-python" / "DocGen" / ".lancedb"
    lance_db = LanceDBManager(db_path=lance_db_path)
    logger.info(f"✓ LanceDB initialized at {lance_db_path}")
    
    # Initialize change detector
    cache_dir = root_path / "src-python" / "DocGen" / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    change_detector = ChangeDetector(cache_dir=cache_dir)
    logger.info(f"✓ Change detector initialized (cache: {cache_dir})")
    
    # Initialize README generator
    readme_generator = READMEGenerator(
        llm_client=llm_client,
        file_access=file_access,
        lance_db=lance_db
    )
    logger.info("✓ README generator initialized")
    
    return file_access, llm_client, lance_db, change_detector, readme_generator


async def watch_mode(
    target_directories: List[Path],
    readme_generator,
    file_access,
    change_detector,
    cost_tracker,
    config: dict,
    force: bool = False,
    review_mode: bool = False
):
    """
    Watch mode: Monitor file changes and auto-regenerate READMEs.
    
    Uses watchdog library to monitor target directories for file changes.
    Debounces rapid changes with a 2-second delay. Triggers incremental
    regeneration when files are saved. Continues running until interrupted.
    
    Args:
        target_directories: List of directories to watch
        readme_generator: READMEGenerator instance
        file_access: SandboxedFileAccess instance
        change_detector: ChangeDetector instance
        cost_tracker: CostTracker instance for budget enforcement
        config: Configuration dictionary
        force: Force regeneration bypassing change detection
        review_mode: Display content and prompt for approval before writing
    
    Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7
    """
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    import threading
    
    logger.info("=" * 60)
    logger.info("WATCH MODE ENABLED")
    logger.info("=" * 60)
    logger.info("Monitoring directories for file changes...")
    logger.info("Press Ctrl+C to stop watching")
    logger.info("")
    
    # Get file extensions to watch
    file_extensions = config.get('indexing', {}).get('file_extensions', ['.rs', '.ts', '.tsx', '.py', '.wgsl', '.json'])
    
    # Debounce settings (Requirement 30.4)
    debounce_delay = 2.0  # 2 seconds
    pending_changes = {}  # {dir_path: last_change_time}
    pending_lock = threading.Lock()
    
    class CodeFileEventHandler(FileSystemEventHandler):
        """Handler for file system events in watched directories."""
        
        def __init__(self, root_dir: Path):
            self.root_dir = root_dir
            super().__init__()
        
        def on_modified(self, event):
            """Handle file modification events."""
            if event.is_directory:
                return
            
            file_path = Path(event.src_path)
            
            # Check if file extension is in watch list
            if file_path.suffix not in file_extensions:
                return
            
            # Get the directory containing the modified file
            dir_path = file_path.parent
            
            # Update pending changes with debounce (Requirement 30.4)
            with pending_lock:
                pending_changes[dir_path] = time.time()
                logger.debug(f"File modified: {file_path.relative_to(self.root_dir)}")
    
    # Create observers for each target directory (Requirement 30.2)
    observers = []
    for target_dir in target_directories:
        handler = CodeFileEventHandler(target_dir)
        observer = Observer()
        observer.schedule(handler, str(target_dir), recursive=True)
        observer.start()
        observers.append(observer)
        logger.info(f"Watching: {target_dir}")
    
    logger.info("")
    
    # Get concurrency and rate limit settings
    max_concurrency = config['performance']['max_concurrent_requests']
    rate_limit_delay = config['performance']['rate_limit_delay_ms'] / 1000.0
    
    try:
        # Main watch loop (Requirement 30.6)
        while True:
            await asyncio.sleep(0.5)  # Check every 500ms
            
            # Check for pending changes that have passed debounce delay
            dirs_to_process = []
            current_time = time.time()
            
            with pending_lock:
                for dir_path, last_change_time in list(pending_changes.items()):
                    # Check if debounce delay has passed (Requirement 30.4)
                    if current_time - last_change_time >= debounce_delay:
                        dirs_to_process.append(dir_path)
                        del pending_changes[dir_path]
            
            # Process directories that have changes
            if dirs_to_process:
                # Log regeneration with timestamp (Requirement 30.5)
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                logger.info("")
                logger.info("=" * 60)
                logger.info(f"REGENERATION TRIGGERED - {timestamp}")
                logger.info("=" * 60)
                logger.info(f"Processing {len(dirs_to_process)} directories with changes")
                logger.info("")
                
                # Process directories in parallel (Requirement 30.3)
                results = await process_directories_parallel(
                    directories=dirs_to_process,
                    readme_generator=readme_generator,
                    file_access=file_access,
                    change_detector=change_detector,
                    cost_tracker=cost_tracker,
                    max_concurrency=max_concurrency,
                    rate_limit_delay=rate_limit_delay,
                    force=force,
                    review_mode=review_mode
                )
                
                # Report results
                stats = aggregate_results(results)
                logger.info("")
                logger.info(f"Regeneration complete:")
                logger.info(f"  Successful: {stats['successful']}")
                logger.info(f"  Failed: {stats['failed']}")
                logger.info(f"  Skipped: {stats['skipped']}")
                logger.info(f"  Cost: ${stats['total_cost_usd']:.4f}")
                logger.info("")
                logger.info("Continuing to watch for changes...")
                logger.info("")
                
                # Check if budget limit reached (Requirement 30.7)
                remaining = cost_tracker.get_remaining_budget()
                if remaining is not None and remaining <= 0:
                    logger.error("Budget limit reached! Stopping watch mode.")
                    break
    
    except KeyboardInterrupt:
        logger.info("")
        logger.info("Watch mode interrupted by user")
    
    finally:
        # Stop all observers
        logger.info("Stopping file watchers...")
        for observer in observers:
            observer.stop()
            observer.join()
        logger.info("Watch mode stopped")


def main():
    """
    Main entry point for README generation.
    """
    try:
        # Parse arguments
        args = parse_arguments()
        
        # Determine K_OS root path
        # Assume script is in src-python/DocGen/scripts/
        script_dir = Path(__file__).parent
        root_path = (script_dir.parent.parent.parent).resolve()
        
        logger.info(f"K_OS root path: {root_path}")
        
        # Load configuration
        config_path = root_path / "src-python" / "DocGen" / "docgen_config.json"
        config = load_config(config_path)
        
        # Override config with command-line arguments
        if args.concurrency is not None:
            config['performance']['max_concurrent_requests'] = args.concurrency
        
        if args.max_cost is not None:
            config['costs']['max_cost_per_run_usd'] = args.max_cost
        
        # Get target directories
        target_directories = get_target_directories(root_path, config, args.path)
        
        if not target_directories:
            logger.error("No target directories found to process")
            return 1
        
        logger.info(f"Found {len(target_directories)} target directories to process")
        
        # Initialize services
        file_access, llm_client, lance_db, change_detector, readme_generator = initialize_services(
            root_path, config, args
        )
        
        # Traverse directories and collect subdirectories that need READMEs
        all_target_dirs = []
        for target_dir in target_directories:
            logger.info(f"Traversing directory: {target_dir}")
            subdirs = traverse_directory(target_dir, file_access, config)
            all_target_dirs.extend(subdirs)
            logger.info(f"Found {len(subdirs)} subdirectories in {target_dir}")
        
        logger.info(f"Total directories to process: {len(all_target_dirs)}")
        
        if args.dry_run:
            logger.info("DRY RUN MODE - No API calls or file writes will be made")
            logger.info("\nDirectories that would be processed:")
            for dir_path in all_target_dirs:
                logger.info(f"  - {dir_path.relative_to(root_path)}")
            logger.info(f"\nTotal: {len(all_target_dirs)} directories")
            return 0
        
        # Initialize cost tracker (Requirement 19.1, 19.2, 19.3)
        cost_log_path = root_path / "src-python" / "DocGen" / "cost_log.json"
        max_cost = config['costs'].get('max_cost_per_run_usd')
        warn_threshold = config['costs'].get('warn_threshold_usd')
        
        # Build command string for logging
        command_parts = ['generate.py']
        if args.path:
            command_parts.append(f'--path {args.path}')
        if args.provider:
            command_parts.append(f'--provider {args.provider}')
        if args.model:
            command_parts.append(f'--model {args.model}')
        if args.force:
            command_parts.append('--force')
        if args.concurrency:
            command_parts.append(f'--concurrency {args.concurrency}')
        if args.max_cost:
            command_parts.append(f'--max-cost {args.max_cost}')
        command_str = ' '.join(command_parts)
        
        cost_tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=max_cost,
            warn_threshold_usd=warn_threshold,
            provider=config['llm']['provider'],
            model=config['llm']['model'],
            command=command_str
        )
        
        # Display cost estimate before starting (Requirement 19.6)
        cost_tracker.display_estimate(len(all_target_dirs))
        
        # Get concurrency and rate limit settings
        max_concurrency = config['performance']['max_concurrent_requests']
        rate_limit_delay = config['performance']['rate_limit_delay_ms'] / 1000.0  # Convert to seconds
        
        logger.info(f"\nStarting README generation:")
        logger.info(f"  Concurrency: {max_concurrency}")
        logger.info(f"  Rate limit delay: {rate_limit_delay}s")
        logger.info(f"  Directories: {len(all_target_dirs)}")
        if args.review_mode:
            logger.info(f"  Review mode: ENABLED (sequential processing)")
        if args.watch:
            logger.info(f"  Watch mode: ENABLED")
        logger.info("")
        
        # Check if watch mode is enabled (Requirement 30.1)
        if args.watch:
            # Run watch mode (Requirement 30.2, 30.3, 30.4, 30.5, 30.6, 30.7)
            asyncio.run(
                watch_mode(
                    target_directories=target_directories,
                    readme_generator=readme_generator,
                    file_access=file_access,
                    change_detector=change_detector,
                    cost_tracker=cost_tracker,
                    config=config,
                    force=args.force,
                    review_mode=args.review_mode
                )
            )
            
            # Save cost log after watch mode ends
            usage_stats = llm_client.get_usage_stats()
            cost_tracker.save_cost_log(
                prompt_tokens=usage_stats['total_prompt_tokens'],
                completion_tokens=usage_stats['total_completion_tokens']
            )
            
            # Display final cost report
            cost_tracker.display_final_report()
            
            return 0
        
        # Run parallel processing (batch mode)
        start_time = time.time()
        results = asyncio.run(
            process_directories_parallel(
                directories=all_target_dirs,
                readme_generator=readme_generator,
                file_access=file_access,
                change_detector=change_detector,
                cost_tracker=cost_tracker,
                max_concurrency=max_concurrency,
                rate_limit_delay=rate_limit_delay,
                force=args.force,
                review_mode=args.review_mode
            )
        )
        
        # Save cost log (Requirement 19.5)
        usage_stats = llm_client.get_usage_stats()
        cost_tracker.save_cost_log(
            prompt_tokens=usage_stats['total_prompt_tokens'],
            completion_tokens=usage_stats['total_completion_tokens']
        )
        
        # Display final cost report
        cost_tracker.display_final_report()
        
        # Report results
        report_progress(results, start_time)
        
        # Check if any failures occurred
        stats = aggregate_results(results)
        if stats['failed'] > 0:
            return 1
        
        return 0
    
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
        return 130
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
