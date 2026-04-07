"""
Base class for external tool integration.

Provides common functionality for tool detection, version checking, and command execution.
All external tools are optional - the system will function without them.
"""

import subprocess
import shutil
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class ExternalTool(ABC):
    """
    Abstract base class for external tool wrappers.
    
    All external tools (ImageMagick, Inkscape, GIMP) inherit from this class
    and implement tool-specific functionality while sharing common infrastructure
    for tool detection, version checking, and command execution.
    """
    
    def __init__(self, executable_name: str):
        """
        Initialize external tool wrapper.
        
        Args:
            executable_name: Name of the executable to search for (e.g., 'convert', 'inkscape', 'gimp')
        """
        self.executable_name = executable_name
        self._executable_path: Optional[Path] = None
        self._version: Optional[str] = None
        self._available: Optional[bool] = None
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if the tool is installed and accessible.
        
        Returns:
            True if tool is available, False otherwise
        """
        pass
    
    @abstractmethod
    def get_version(self) -> str:
        """
        Get the version string of the installed tool.
        
        Returns:
            Version string (e.g., "7.1.0-53") or "unknown" if unavailable
        """
        pass
    
    @abstractmethod
    def execute(self, command: List[str], input_path: Optional[str] = None, 
                output_path: Optional[str] = None, **kwargs) -> bool:
        """
        Execute a tool command.
        
        Args:
            command: Command arguments to pass to the tool
            input_path: Optional input file path
            output_path: Optional output file path
            **kwargs: Additional tool-specific parameters
            
        Returns:
            True if execution succeeded, False otherwise
        """
        pass
    
    def _find_executable(self) -> Optional[Path]:
        """
        Find the executable in system PATH.
        
        Returns:
            Path to executable if found, None otherwise
        """
        if self._executable_path is not None:
            return self._executable_path
        
        exe_path = shutil.which(self.executable_name)
        if exe_path:
            self._executable_path = Path(exe_path)
            logger.info(f"Found {self.executable_name} at {self._executable_path}")
            return self._executable_path
        
        logger.warning(f"{self.executable_name} not found in system PATH")
        return None
    
    def _run_command(self, command: List[str], timeout: int = 60, 
                     capture_output: bool = True) -> subprocess.CompletedProcess:
        """
        Run a subprocess command with error handling.
        
        Args:
            command: Command and arguments to execute
            timeout: Maximum execution time in seconds
            capture_output: Whether to capture stdout/stderr
            
        Returns:
            CompletedProcess instance with execution results
            
        Raises:
            subprocess.TimeoutExpired: If command exceeds timeout
            subprocess.CalledProcessError: If command returns non-zero exit code
        """
        try:
            logger.debug(f"Executing command: {' '.join(command)}")
            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                timeout=timeout,
                check=True
            )
            logger.debug(f"Command succeeded: {command[0]}")
            return result
        except subprocess.TimeoutExpired as e:
            logger.error(f"Command timed out after {timeout}s: {' '.join(command)}")
            raise
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed with exit code {e.returncode}: {' '.join(command)}")
            if e.stderr:
                logger.error(f"Error output: {e.stderr}")
            raise
        except FileNotFoundError as e:
            logger.error(f"Executable not found: {command[0]}")
            raise
    
    def _validate_file_exists(self, file_path: str, file_type: str = "file") -> bool:
        """
        Validate that a file exists.
        
        Args:
            file_path: Path to file to check
            file_type: Description of file type for error messages
            
        Returns:
            True if file exists, False otherwise
        """
        path = Path(file_path)
        if not path.exists():
            logger.error(f"{file_type} not found: {file_path}")
            return False
        if not path.is_file():
            logger.error(f"{file_type} is not a file: {file_path}")
            return False
        return True
    
    def _ensure_output_directory(self, output_path: str) -> bool:
        """
        Ensure the output directory exists.
        
        Args:
            output_path: Path to output file
            
        Returns:
            True if directory exists or was created, False on error
        """
        try:
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            return True
        except Exception as e:
            logger.error(f"Failed to create output directory: {e}")
            return False
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get information about the tool.
        
        Returns:
            Dictionary with tool information (name, available, version, path)
        """
        return {
            "name": self.executable_name,
            "available": self.is_available(),
            "version": self.get_version() if self.is_available() else "not installed",
            "path": str(self._executable_path) if self._executable_path else None
        }
    
    def __repr__(self) -> str:
        """String representation of the tool."""
        available = "available" if self.is_available() else "not available"
        version = self.get_version() if self.is_available() else "N/A"
        return f"<{self.__class__.__name__}({self.executable_name}): {available}, version={version}>"
