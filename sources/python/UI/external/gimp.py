"""
GIMP batch mode wrapper for complex image operations.

Provides advanced batch processing via GIMP's Python-Fu scripting interface.
GIMP is optional - the system will function without it using Pillow/numpy fallbacks.
"""

import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
import tempfile
import re

from .base import ExternalTool

logger = logging.getLogger(__name__)


class GIMPTool(ExternalTool):
    """
    Wrapper for GIMP batch mode operations.
    
    Provides complex image processing via GIMP's Python-Fu scripting interface.
    Falls back gracefully if GIMP is not installed.
    
    GIMP batch mode supports:
    - Complex filter chains
    - Layer manipulation
    - Advanced color corrections
    - Plugin-based effects
    - Script-Fu and Python-Fu scripts
    """
    
    def __init__(self):
        """Initialize GIMP tool wrapper."""
        super().__init__("gimp")
        self._console_mode = False
        
        # Check for gimp-console (headless mode)
        if not self._find_executable():
            self.executable_name = "gimp-console"
            self._executable_path = None
            if self._find_executable():
                self._console_mode = True
                logger.info("Using GIMP console mode (headless)")
    
    def is_available(self) -> bool:
        """
        Check if GIMP is installed and accessible.
        
        Returns:
            True if GIMP is available, False otherwise
        """
        if self._available is not None:
            return self._available
        
        self._available = self._find_executable() is not None
        return self._available
    
    def get_version(self) -> str:
        """
        Get GIMP version string.
        
        Returns:
            Version string (e.g., "2.10.34") or "unknown" if unavailable
        """
        if self._version is not None:
            return self._version
        
        if not self.is_available():
            return "unknown"
        
        try:
            # Run version command
            command = [str(self._executable_path), "--version"]
            result = self._run_command(command, timeout=10)
            
            # Parse version from output (e.g., "GNU Image Manipulation Program version 2.10.34")
            version_match = re.search(r'version\s+([\d.]+)', result.stdout)
            if version_match:
                self._version = version_match.group(1)
            else:
                self._version = "unknown"
            
            return self._version
        except Exception as e:
            logger.error(f"Failed to get GIMP version: {e}")
            return "unknown"
    
    def execute(self, command: List[str], input_path: Optional[str] = None,
                output_path: Optional[str] = None, **kwargs) -> bool:
        """
        Execute a GIMP batch command.
        
        Args:
            command: Command arguments (without executable name)
            input_path: Optional input file path
            output_path: Optional output file path
            **kwargs: Additional parameters (timeout, etc.)
            
        Returns:
            True if execution succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("GIMP is not available")
            return False
        
        # Validate input file if provided
        if input_path and not self._validate_file_exists(input_path, "Input image"):
            return False
        
        # Ensure output directory exists if output path provided
        if output_path and not self._ensure_output_directory(output_path):
            return False
        
        # Build full command with batch mode flags
        full_command = [
            str(self._executable_path),
            '-i',  # No interface (batch mode)
            '-b',  # Batch mode
        ]
        full_command.extend(command)
        full_command.extend(['-b', '(gimp-quit 0)'])  # Quit after execution
        
        try:
            timeout = kwargs.get('timeout', 120)  # GIMP can be slow
            self._run_command(full_command, timeout=timeout)
            return True
        except Exception as e:
            logger.error(f"GIMP command failed: {e}")
            return False
    
    def run_script(self, script_content: str, input_path: Optional[str] = None,
                   output_path: Optional[str] = None) -> bool:
        """
        Run a Python-Fu or Script-Fu script in batch mode.
        
        Args:
            script_content: Script content (Python-Fu or Scheme)
            input_path: Optional input file path
            output_path: Optional output file path
            
        Returns:
            True if script execution succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("GIMP is not available for script execution")
            return False
        
        # Create temporary script file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.scm', delete=False) as f:
            script_path = f.name
            f.write(script_content)
        
        try:
            # Execute script
            command = ['-b', f'(load "{script_path}")']
            result = self.execute(command, input_path, output_path, timeout=120)
            return result
        finally:
            # Clean up temporary script file
            try:
                Path(script_path).unlink()
            except Exception as e:
                logger.warning(f"Failed to delete temporary script: {e}")
    
    def batch_process(self, input_paths: List[str], output_dir: str,
                      operation: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:
        """
        Batch process multiple images with a GIMP operation.
        
        Args:
            input_paths: List of input image paths
            output_dir: Output directory for processed images
            operation: Operation name (blur, sharpen, normalize, etc.)
            params: Operation-specific parameters
            
        Returns:
            Dictionary mapping input paths to success status
        """
        if not self.is_available():
            logger.error("GIMP is not available for batch processing")
            return {path: False for path in input_paths}
        
        params = params or {}
        results = {}
        output_path_obj = Path(output_dir)
        output_path_obj.mkdir(parents=True, exist_ok=True)
        
        for input_path in input_paths:
            input_path_obj = Path(input_path)
            output_path = output_path_obj / input_path_obj.name
            
            # Generate script for this operation
            script = self._generate_operation_script(
                str(input_path),
                str(output_path),
                operation,
                params
            )
            
            if script:
                success = self.run_script(script, str(input_path), str(output_path))
                results[input_path] = success
            else:
                logger.error(f"Unknown operation: {operation}")
                results[input_path] = False
        
        return results
    
    def _generate_operation_script(self, input_path: str, output_path: str,
                                   operation: str, params: Dict[str, Any]) -> Optional[str]:
        """
        Generate a Script-Fu script for a specific operation.
        
        Args:
            input_path: Input file path
            output_path: Output file path
            operation: Operation name
            params: Operation parameters
            
        Returns:
            Script-Fu script content or None if operation unknown
        """
        # Base script template
        script_template = f"""
(let* ((image (car (gimp-file-load RUN-NONINTERACTIVE "{input_path}" "{input_path}")))
       (drawable (car (gimp-image-get-active-layer image))))
  
  {{operations}}
  
  (gimp-file-save RUN-NONINTERACTIVE image drawable "{output_path}" "{output_path}")
  (gimp-image-delete image))
"""
        
        operations = []
        
        # Generate operation-specific code
        if operation == 'blur':
            radius = params.get('radius', 5)
            operations.append(f'(plug-in-gauss RUN-NONINTERACTIVE image drawable {radius} {radius} 0)')
        
        elif operation == 'sharpen':
            sharpness = params.get('sharpness', 50)
            operations.append(f'(plug-in-sharpen RUN-NONINTERACTIVE image drawable {sharpness})')
        
        elif operation == 'normalize':
            operations.append('(gimp-levels-stretch drawable)')
        
        elif operation == 'auto-levels':
            operations.append('(gimp-levels-auto drawable)')
        
        elif operation == 'desaturate':
            operations.append('(gimp-desaturate drawable)')
        
        elif operation == 'invert':
            operations.append('(gimp-invert drawable)')
        
        elif operation == 'brightness-contrast':
            brightness = params.get('brightness', 0)
            contrast = params.get('contrast', 0)
            operations.append(f'(gimp-brightness-contrast drawable {brightness} {contrast})')
        
        elif operation == 'hue-saturation':
            hue = params.get('hue', 0)
            saturation = params.get('saturation', 0)
            lightness = params.get('lightness', 0)
            operations.append(f'(gimp-hue-saturation drawable 0 {hue} {lightness} {saturation})')
        
        elif operation == 'edge-detect':
            algorithm = params.get('algorithm', 1)  # 1 = Sobel
            amount = params.get('amount', 2.0)
            operations.append(f'(plug-in-edge RUN-NONINTERACTIVE image drawable {amount} 1 {algorithm})')
        
        elif operation == 'emboss':
            azimuth = params.get('azimuth', 45)
            elevation = params.get('elevation', 45)
            depth = params.get('depth', 20)
            operations.append(f'(plug-in-emboss RUN-NONINTERACTIVE image drawable {azimuth} {elevation} {depth} 1)')
        
        else:
            logger.error(f"Unknown GIMP operation: {operation}")
            return None
        
        # Insert operations into template
        operations_code = '\n  '.join(operations)
        script = script_template.replace('{operations}', operations_code)
        
        return script
    
    def apply_filter_chain(self, input_path: str, output_path: str,
                          filters: List[Dict[str, Any]]) -> bool:
        """
        Apply a chain of filters to an image.
        
        Args:
            input_path: Path to input image
            output_path: Path to output image
            filters: List of filter dictionaries with 'operation' and 'params' keys
            
        Returns:
            True if filter chain succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("GIMP is not available for filter chains")
            return False
        
        # Generate script with multiple operations
        operations = []
        for filter_def in filters:
            operation = filter_def.get('operation')
            params = filter_def.get('params', {})
            
            # Generate operation code (simplified - would need full implementation)
            if operation == 'blur':
                radius = params.get('radius', 5)
                operations.append(f'(plug-in-gauss RUN-NONINTERACTIVE image drawable {radius} {radius} 0)')
            elif operation == 'sharpen':
                sharpness = params.get('sharpness', 50)
                operations.append(f'(plug-in-sharpen RUN-NONINTERACTIVE image drawable {sharpness})')
            # Add more operations as needed
        
        if not operations:
            logger.error("No valid operations in filter chain")
            return False
        
        # Build complete script
        script = f"""
(let* ((image (car (gimp-file-load RUN-NONINTERACTIVE "{input_path}" "{input_path}")))
       (drawable (car (gimp-image-get-active-layer image))))
  
  {chr(10).join('  ' + op for op in operations)}
  
  (gimp-file-save RUN-NONINTERACTIVE image drawable "{output_path}" "{output_path}")
  (gimp-image-delete image))
"""
        
        return self.run_script(script, input_path, output_path)
