"""
Change Detection System for Automated README Generation

This module provides file change detection and classification to determine
if documentation needs regeneration. It uses SHA-256 hashing and timestamp
tracking to identify changes, and classifies them as structural, behavioral,
or cosmetic to optimize documentation updates.

Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7
"""

import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List


class ChangeType(Enum):
    """Classification of file changes for documentation regeneration decisions."""
    STRUCTURAL = "structural"  # New functions, classes, modules
    BEHAVIORAL = "behavioral"  # Logic changes, algorithm updates
    COSMETIC = "cosmetic"  # Comments, formatting, whitespace


@dataclass
class ChangeReport:
    """Report of file changes detected in a directory scan."""
    added_files: List[Path] = field(default_factory=list)
    modified_files: List[Path] = field(default_factory=list)
    deleted_files: List[Path] = field(default_factory=list)
    unchanged_files: List[Path] = field(default_factory=list)
    change_classifications: Dict[Path, ChangeType] = field(default_factory=dict)


class ChangeDetector:
    """
    Detects file changes and classifies them to determine documentation regeneration needs.
    
    Uses SHA-256 hashing and timestamp tracking to identify changes. Classifies changes
    as structural (new code elements), behavioral (logic changes), or cosmetic (formatting).
    Only structural and behavioral changes trigger README regeneration.
    
    Cache format: {file_path: {hash, timestamp, last_analyzed}}
    """
    
    def __init__(self, cache_dir: Path):
        """
        Initialize ChangeDetector with cache directory.
        
        Args:
            cache_dir: Directory to store analysis cache (e.g., .cache/)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_file = self.cache_dir / "analysis_cache.json"
        self.cache = self._load_cache()
    
    def _load_cache(self) -> Dict:
        """Load cache from JSON file."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Failed to load cache: {e}. Starting with empty cache.")
                return {}
        return {}
    
    def _save_cache(self) -> None:
        """Save cache to JSON file."""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, indent=2)
        except IOError as e:
            print(f"Warning: Failed to save cache: {e}")
    
    def compute_file_hash(self, file_path: Path) -> str:
        """
        Compute SHA-256 hash of file content.
        
        Args:
            file_path: Path to file to hash
            
        Returns:
            Hexadecimal SHA-256 hash string
            
        Requirement: 23.1
        """
        try:
            with open(file_path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except IOError as e:
            print(f"Warning: Failed to hash {file_path}: {e}")
            return ""
    
    def classify_change(self, old_content: str, new_content: str) -> ChangeType:
        """
        Classify change as structural, behavioral, or cosmetic.
        
        Uses heuristics to determine change type:
        - Structural: New/removed functions, classes, modules, interfaces, exports
        - Behavioral: Changes inside function bodies (non-comment/whitespace)
        - Cosmetic: Only whitespace/comment changes
        
        Args:
            old_content: Previous file content
            new_content: Current file content
            
        Returns:
            ChangeType classification
            
        Requirements: 23.3, 23.4
        """
        # Patterns for structural elements
        structural_patterns = [
            r'\bdef\s+\w+',  # Python functions
            r'\bclass\s+\w+',  # Python/TypeScript classes
            r'\bfn\s+\w+',  # Rust functions
            r'\binterface\s+\w+',  # TypeScript interfaces
            r'\bexport\s+',  # TypeScript exports
            r'\bpub\s+fn\s+\w+',  # Rust public functions
            r'\bpub\s+struct\s+\w+',  # Rust public structs
            r'\bpub\s+enum\s+\w+',  # Rust public enums
            r'\basync\s+fn\s+\w+',  # Rust async functions
            r'\bconst\s+\w+\s*=',  # Const declarations
            r'\blet\s+\w+\s*=\s*\(',  # Function assignments
        ]
        
        # Extract structural elements from both versions
        old_structural = set()
        new_structural = set()
        
        for pattern in structural_patterns:
            old_structural.update(re.findall(pattern, old_content))
            new_structural.update(re.findall(pattern, new_content))
        
        # Check for structural changes (added/removed elements)
        if old_structural != new_structural:
            return ChangeType.STRUCTURAL
        
        # Remove comments and whitespace for behavioral comparison
        old_normalized = self._normalize_content(old_content)
        new_normalized = self._normalize_content(new_content)
        
        # If normalized content differs, it's a behavioral change
        if old_normalized != new_normalized:
            return ChangeType.BEHAVIORAL
        
        # Only comments/whitespace changed
        return ChangeType.COSMETIC
    
    def _normalize_content(self, content: str) -> str:
        """
        Normalize content by removing comments and whitespace.
        
        Args:
            content: File content to normalize
            
        Returns:
            Normalized content with comments and extra whitespace removed
        """
        # Remove single-line comments (// and #)
        content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
        content = re.sub(r'#.*?$', '', content, flags=re.MULTILINE)
        
        # Remove multi-line comments (/* */ and """ """)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        content = re.sub(r'""".*?"""', '', content, flags=re.DOTALL)
        content = re.sub(r"'''.*?'''", '', content, flags=re.DOTALL)
        
        # Remove docstrings (Python)
        content = re.sub(r'^\s*""".*?"""\s*$', '', content, flags=re.MULTILINE | re.DOTALL)
        content = re.sub(r"^\s*'''.*?'''\s*$", '', content, flags=re.MULTILINE | re.DOTALL)
        
        # Remove all whitespace and normalize
        content = re.sub(r'\s+', '', content)
        
        return content
    
    def scan_directory(self, dir_path: Path, file_extensions: List[str] = None) -> ChangeReport:
        """
        Scan directory and detect changes since last run.
        
        Compares current file hashes and timestamps against cached values to identify
        added, modified, deleted, and unchanged files. Classifies modifications to
        determine if documentation regeneration is needed.
        
        Args:
            dir_path: Directory to scan
            file_extensions: List of file extensions to scan (e.g., ['.rs', '.ts', '.py'])
                           If None, scans all files
            
        Returns:
            ChangeReport with categorized file changes
            
        Requirements: 23.2, 23.5, 23.6
        """
        report = ChangeReport()
        
        if not dir_path.exists():
            print(f"Warning: Directory {dir_path} does not exist")
            return report
        
        # Default file extensions if not specified
        if file_extensions is None:
            file_extensions = ['.rs', '.ts', '.tsx', '.py', '.wgsl', '.json', '.toml']
        
        # Get all files in directory (non-recursive for now)
        current_files = set()
        for ext in file_extensions:
            current_files.update(dir_path.glob(f'*{ext}'))
        
        # Convert to relative paths for cache keys
        dir_path_str = str(dir_path)
        cached_files = set()
        
        # Find cached files for this directory
        for cached_path in self.cache.keys():
            if cached_path.startswith(dir_path_str):
                cached_files.add(Path(cached_path))
        
        # Detect added files
        for file_path in current_files:
            file_path_str = str(file_path)
            
            if file_path_str not in self.cache:
                report.added_files.append(file_path)
                # Compute and cache hash for new file
                file_hash = self.compute_file_hash(file_path)
                self.update_cache(file_path, file_hash)
            else:
                # Check if file was modified
                cached_entry = self.cache[file_path_str]
                current_hash = self.compute_file_hash(file_path)
                
                if current_hash != cached_entry.get('hash', ''):
                    report.modified_files.append(file_path)
                    
                    # Classify the change
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            new_content = f.read()
                        
                        # Try to get old content from cache or re-read
                        old_content = cached_entry.get('content', '')
                        if not old_content:
                            # If we don't have cached content, assume behavioral change
                            change_type = ChangeType.BEHAVIORAL
                        else:
                            change_type = self.classify_change(old_content, new_content)
                        
                        report.change_classifications[file_path] = change_type
                    except (IOError, UnicodeDecodeError) as e:
                        print(f"Warning: Failed to classify change for {file_path}: {e}")
                        # Default to behavioral if we can't classify
                        report.change_classifications[file_path] = ChangeType.BEHAVIORAL
                    
                    # Update cache with new hash
                    self.update_cache(file_path, current_hash)
                else:
                    report.unchanged_files.append(file_path)
        
        # Detect deleted files
        for cached_path in cached_files:
            if cached_path not in current_files:
                report.deleted_files.append(cached_path)
                # Remove from cache
                if str(cached_path) in self.cache:
                    del self.cache[str(cached_path)]
        
        # Save updated cache
        self._save_cache()
        
        return report
    
    def update_cache(self, file_path: Path, content_hash: str) -> None:
        """
        Update cache with new hash and timestamp.
        
        Args:
            file_path: Path to file
            content_hash: SHA-256 hash of file content
            
        Requirement: 23.7
        """
        import time
        
        file_path_str = str(file_path)
        
        # Get file modification timestamp
        try:
            timestamp = file_path.stat().st_mtime
        except OSError:
            timestamp = time.time()
        
        # Update cache entry
        self.cache[file_path_str] = {
            'hash': content_hash,
            'timestamp': timestamp,
            'last_analyzed': time.time()
        }
        
        # Save cache immediately
        self._save_cache()
