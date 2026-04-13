"""
Sandboxed File Access Layer for DocGen System

This module provides secure file access for the AI documentation agent.
The agent has READ access to all files in the K_OS codebase but WRITE access
is restricted to .md files only, preventing accidental modification of source code.

Security Features:
- Path traversal prevention using pathlib.Path.resolve()
- Write access restricted to .md extension only
- All paths validated against root directory
- Comprehensive logging of all file operations
"""

from pathlib import Path
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """Raised when a file access security constraint is violated."""
    pass


class SandboxedFileAccess:
    """
    Provides sandboxed file access for the AI documentation agent.
    
    The agent can read any file within the root path but can only write
    files with allowed extensions (default: .md only).
    
    Attributes:
        root_path: The root directory for all file operations (typically K_OS root)
        allowed_write_extensions: List of file extensions that can be written
    """
    
    def __init__(self, root_path: Path, allowed_write_extensions: Optional[List[str]] = None):
        """
        Initialize the sandboxed file access layer.
        
        Args:
            root_path: Root directory for all file operations (e.g., M:\\K_OS)
            allowed_write_extensions: List of extensions allowed for writing (default: ['.md'])
        
        Raises:
            ValueError: If root_path doesn't exist or isn't a directory
        """
        self.root_path = Path(root_path).resolve()
        
        if not self.root_path.exists():
            raise ValueError(f"Root path does not exist: {self.root_path}")
        
        if not self.root_path.is_dir():
            raise ValueError(f"Root path is not a directory: {self.root_path}")
        
        self.allowed_write_extensions = allowed_write_extensions or ['.md']
        
        logger.info(f"SandboxedFileAccess initialized with root: {self.root_path}")
        logger.info(f"Allowed write extensions: {self.allowed_write_extensions}")
    
    def _validate_path(self, path: Path) -> Path:
        """
        Validate that a path is within the root directory.
        
        Uses Path.resolve() to prevent path traversal attacks (e.g., ../../../etc/passwd).
        
        Args:
            path: Path to validate (can be relative or absolute)
        
        Returns:
            Resolved absolute path
        
        Raises:
            SecurityError: If path is outside root directory
        """
        # Convert to Path if string
        if isinstance(path, str):
            path = Path(path)
        
        # If path is relative, make it relative to root
        if not path.is_absolute():
            path = self.root_path / path
        
        # Resolve to absolute path (follows symlinks, removes ..)
        resolved_path = path.resolve()
        
        # Check if resolved path is within root
        try:
            resolved_path.relative_to(self.root_path)
        except ValueError:
            raise SecurityError(
                f"Path traversal detected: {path} resolves to {resolved_path}, "
                f"which is outside root {self.root_path}"
            )
        
        return resolved_path
    
    def _validate_write_extension(self, path: Path) -> None:
        """
        Validate that a file has an allowed write extension.
        
        Args:
            path: Path to validate
        
        Raises:
            SecurityError: If file extension is not in allowed list
        """
        extension = path.suffix.lower()
        
        if extension not in self.allowed_write_extensions:
            raise SecurityError(
                f"Write access denied: {path} has extension '{extension}', "
                f"only {self.allowed_write_extensions} are allowed"
            )
    
    def read_file(self, path: Path) -> str:
        """
        Read a file's contents.
        
        The agent can read ANY file within the root directory.
        
        Args:
            path: Path to file (relative to root or absolute)
        
        Returns:
            File contents as string
        
        Raises:
            SecurityError: If path is outside root directory
            FileNotFoundError: If file doesn't exist
            IOError: If file cannot be read
        """
        validated_path = self._validate_path(path)
        
        if not validated_path.exists():
            raise FileNotFoundError(f"File not found: {validated_path}")
        
        if not validated_path.is_file():
            raise IOError(f"Path is not a file: {validated_path}")
        
        try:
            with open(validated_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            logger.debug(f"Read file: {validated_path} ({len(content)} chars)")
            return content
        
        except UnicodeDecodeError:
            # Try binary mode for non-text files
            logger.warning(f"UTF-8 decode failed for {validated_path}, trying binary mode")
            with open(validated_path, 'rb') as f:
                content = f.read()
            return content.decode('utf-8', errors='replace')
        
        except Exception as e:
            logger.error(f"Failed to read file {validated_path}: {e}")
            raise IOError(f"Failed to read file {validated_path}: {e}")
    
    def write_file(self, path: Path, content: str) -> None:
        """
        Write content to a file.
        
        The agent can ONLY write files with allowed extensions (default: .md only).
        This prevents accidental modification of source code during autonomous operation.
        
        Args:
            path: Path to file (relative to root or absolute)
            content: Content to write
        
        Raises:
            SecurityError: If path is outside root or extension not allowed
            IOError: If file cannot be written
        """
        validated_path = self._validate_path(path)
        self._validate_write_extension(validated_path)
        
        try:
            # Create parent directories if they don't exist
            validated_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(validated_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.info(f"Wrote file: {validated_path} ({len(content)} chars)")
        
        except Exception as e:
            logger.error(f"Failed to write file {validated_path}: {e}")
            raise IOError(f"Failed to write file {validated_path}: {e}")
    
    def list_directory(self, path: Path, recursive: bool = False) -> List[Path]:
        """
        List contents of a directory.
        
        Args:
            path: Path to directory (relative to root or absolute)
            recursive: If True, recursively list all subdirectories
        
        Returns:
            List of Path objects (relative to root)
        
        Raises:
            SecurityError: If path is outside root directory
            FileNotFoundError: If directory doesn't exist
            IOError: If path is not a directory
        """
        validated_path = self._validate_path(path)
        
        if not validated_path.exists():
            raise FileNotFoundError(f"Directory not found: {validated_path}")
        
        if not validated_path.is_dir():
            raise IOError(f"Path is not a directory: {validated_path}")
        
        try:
            if recursive:
                # Recursively list all files and directories
                paths = []
                for item in validated_path.rglob('*'):
                    # Return paths relative to root
                    relative_path = item.relative_to(self.root_path)
                    paths.append(relative_path)
                
                logger.debug(f"Listed directory recursively: {validated_path} ({len(paths)} items)")
                return sorted(paths)
            else:
                # List only immediate children
                paths = []
                for item in validated_path.iterdir():
                    # Return paths relative to root
                    relative_path = item.relative_to(self.root_path)
                    paths.append(relative_path)
                
                logger.debug(f"Listed directory: {validated_path} ({len(paths)} items)")
                return sorted(paths)
        
        except Exception as e:
            logger.error(f"Failed to list directory {validated_path}: {e}")
            raise IOError(f"Failed to list directory {validated_path}: {e}")
    
    def file_exists(self, path: Path) -> bool:
        """
        Check if a file or directory exists.
        
        Args:
            path: Path to check (relative to root or absolute)
        
        Returns:
            True if path exists, False otherwise
        
        Raises:
            SecurityError: If path is outside root directory
        """
        try:
            validated_path = self._validate_path(path)
            exists = validated_path.exists()
            logger.debug(f"Checked existence: {validated_path} -> {exists}")
            return exists
        
        except SecurityError:
            # If path is outside root, treat as non-existent
            logger.warning(f"Path outside root: {path}")
            raise
