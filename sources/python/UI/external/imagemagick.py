"""
ImageMagick CLI wrapper for advanced image operations.

Provides format conversion, compositing, and effects via ImageMagick command-line tools.
ImageMagick is optional - the system will function without it using Pillow fallbacks.
"""

import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
import re

from .base import ExternalTool

logger = logging.getLogger(__name__)


class ImageMagickTool(ExternalTool):
    """
    Wrapper for ImageMagick CLI tools.
    
    Provides advanced image operations including format conversion, compositing,
    effects, and batch processing. Falls back gracefully if ImageMagick is not installed.
    
    Common ImageMagick executables:
    - convert: Image format conversion and manipulation
    - magick: Modern unified ImageMagick interface (v7+)
    - composite: Image compositing operations
    """
    
    def __init__(self):
        """Initialize ImageMagick tool wrapper."""
        # Try modern 'magick' command first (ImageMagick 7+), fall back to 'convert' (v6)
        super().__init__("magick")
        self._legacy_mode = False
        
        # Check if modern magick command is available
        if not self._find_executable():
            # Fall back to legacy 'convert' command
            self.executable_name = "convert"
            self._executable_path = None
            if self._find_executable():
                self._legacy_mode = True
                logger.info("Using legacy ImageMagick 'convert' command (v6)")
    
    def is_available(self) -> bool:
        """
        Check if ImageMagick is installed and accessible.
        
        Returns:
            True if ImageMagick is available, False otherwise
        """
        if self._available is not None:
            return self._available
        
        self._available = self._find_executable() is not None
        return self._available
    
    def get_version(self) -> str:
        """
        Get ImageMagick version string.
        
        Returns:
            Version string (e.g., "7.1.0-53") or "unknown" if unavailable
        """
        if self._version is not None:
            return self._version
        
        if not self.is_available():
            return "unknown"
        
        try:
            # Run version command
            command = [str(self._executable_path), "-version"]
            result = self._run_command(command, timeout=5)
            
            # Parse version from output (e.g., "Version: ImageMagick 7.1.0-53")
            version_match = re.search(r'ImageMagick\s+([\d.]+(?:-\d+)?)', result.stdout)
            if version_match:
                self._version = version_match.group(1)
            else:
                self._version = "unknown"
            
            return self._version
        except Exception as e:
            logger.error(f"Failed to get ImageMagick version: {e}")
            return "unknown"
    
    def execute(self, command: List[str], input_path: Optional[str] = None,
                output_path: Optional[str] = None, **kwargs) -> bool:
        """
        Execute an ImageMagick command.
        
        Args:
            command: Command arguments (without executable name)
            input_path: Optional input file path
            output_path: Optional output file path
            **kwargs: Additional parameters (timeout, etc.)
            
        Returns:
            True if execution succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("ImageMagick is not available")
            return False
        
        # Validate input file if provided
        if input_path and not self._validate_file_exists(input_path, "Input image"):
            return False
        
        # Ensure output directory exists if output path provided
        if output_path and not self._ensure_output_directory(output_path):
            return False
        
        # Build full command
        full_command = [str(self._executable_path)]
        
        # For legacy mode, we need to use 'convert' directly
        # For modern mode, we need to add the subcommand (e.g., 'magick convert')
        if not self._legacy_mode and command and command[0] not in ['convert', 'composite', 'identify']:
            full_command.append('convert')
        
        full_command.extend(command)
        
        try:
            timeout = kwargs.get('timeout', 60)
            self._run_command(full_command, timeout=timeout)
            return True
        except Exception as e:
            logger.error(f"ImageMagick command failed: {e}")
            return False
    
    def convert(self, input_path: str, output_path: str, 
                options: Optional[Dict[str, Any]] = None) -> bool:
        """
        Convert image format with optional transformations.
        
        Args:
            input_path: Path to input image
            output_path: Path to output image
            options: Optional conversion options:
                - resize: Tuple (width, height) or string "WxH"
                - quality: JPEG quality (1-100)
                - depth: Bit depth (8, 16, 32)
                - colorspace: Color space (RGB, CMYK, Gray, etc.)
                - format: Output format (png, jpg, webp, etc.)
                - compress: Compression type (None, Zip, LZW, etc.)
                - background: Background color for transparency
                - flatten: Flatten layers (bool)
                - strip: Strip metadata (bool)
                
        Returns:
            True if conversion succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("ImageMagick is not available for conversion")
            return False
        
        options = options or {}
        command = []
        
        # Input file
        command.append(input_path)
        
        # Apply options
        if 'resize' in options:
            resize = options['resize']
            if isinstance(resize, tuple):
                command.extend(['-resize', f'{resize[0]}x{resize[1]}'])
            else:
                command.extend(['-resize', str(resize)])
        
        if 'quality' in options:
            command.extend(['-quality', str(options['quality'])])
        
        if 'depth' in options:
            command.extend(['-depth', str(options['depth'])])
        
        if 'colorspace' in options:
            command.extend(['-colorspace', options['colorspace']])
        
        if 'compress' in options:
            command.extend(['-compress', options['compress']])
        
        if 'background' in options:
            command.extend(['-background', options['background']])
        
        if options.get('flatten', False):
            command.append('-flatten')
        
        if options.get('strip', False):
            command.append('-strip')
        
        # Output file
        command.append(output_path)
        
        return self.execute(command, input_path, output_path)
    
    def composite(self, base_path: str, overlay_path: str, output_path: str,
                  mode: str = 'over', offset: Optional[tuple] = None,
                  opacity: Optional[float] = None) -> bool:
        """
        Composite two images together.
        
        Args:
            base_path: Path to base image
            overlay_path: Path to overlay image
            output_path: Path to output image
            mode: Composite mode (over, multiply, screen, overlay, add, etc.)
            offset: Optional (x, y) offset for overlay placement
            opacity: Optional opacity for overlay (0.0-1.0)
            
        Returns:
            True if compositing succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("ImageMagick is not available for compositing")
            return False
        
        # Validate input files
        if not self._validate_file_exists(base_path, "Base image"):
            return False
        if not self._validate_file_exists(overlay_path, "Overlay image"):
            return False
        
        command = []
        
        # For modern ImageMagick, use 'composite' subcommand
        if not self._legacy_mode:
            command.append('composite')
        
        # Composite mode
        command.extend(['-compose', mode])
        
        # Opacity
        if opacity is not None:
            command.extend(['-dissolve', str(int(opacity * 100))])
        
        # Offset
        if offset:
            command.extend(['-geometry', f'+{offset[0]}+{offset[1]}'])
        
        # Images: overlay, base, output
        command.extend([overlay_path, base_path, output_path])
        
        return self.execute(command, base_path, output_path)
    
    def apply_effect(self, input_path: str, output_path: str,
                     effect: str, **params) -> bool:
        """
        Apply an effect to an image.
        
        Args:
            input_path: Path to input image
            output_path: Path to output image
            effect: Effect name (blur, sharpen, edge, emboss, etc.)
            **params: Effect-specific parameters
            
        Returns:
            True if effect application succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("ImageMagick is not available for effects")
            return False
        
        command = [input_path]
        
        # Apply effect based on type
        if effect == 'blur':
            radius = params.get('radius', 5)
            sigma = params.get('sigma', 3)
            command.extend(['-blur', f'{radius}x{sigma}'])
        
        elif effect == 'sharpen':
            radius = params.get('radius', 0)
            sigma = params.get('sigma', 1)
            command.extend(['-sharpen', f'{radius}x{sigma}'])
        
        elif effect == 'edge':
            radius = params.get('radius', 1)
            command.extend(['-edge', str(radius)])
        
        elif effect == 'emboss':
            radius = params.get('radius', 0)
            sigma = params.get('sigma', 1)
            command.extend(['-emboss', f'{radius}x{sigma}'])
        
        elif effect == 'negate':
            command.append('-negate')
        
        elif effect == 'normalize':
            command.append('-normalize')
        
        elif effect == 'equalize':
            command.append('-equalize')
        
        else:
            logger.error(f"Unknown effect: {effect}")
            return False
        
        command.append(output_path)
        
        return self.execute(command, input_path, output_path)
    
    def batch_convert(self, input_paths: List[str], output_dir: str,
                      options: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:
        """
        Batch convert multiple images.
        
        Args:
            input_paths: List of input image paths
            output_dir: Output directory for converted images
            options: Conversion options (same as convert())
            
        Returns:
            Dictionary mapping input paths to success status
        """
        results = {}
        output_path_obj = Path(output_dir)
        output_path_obj.mkdir(parents=True, exist_ok=True)
        
        for input_path in input_paths:
            input_path_obj = Path(input_path)
            output_path = output_path_obj / input_path_obj.name
            
            success = self.convert(str(input_path), str(output_path), options)
            results[input_path] = success
        
        return results
