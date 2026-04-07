"""
Inkscape CLI wrapper for SVG operations.

Provides SVG optimization and rendering via Inkscape command-line interface.
Inkscape is optional - the system will function without it using cairosvg fallbacks.
"""

import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
import re

from .base import ExternalTool

logger = logging.getLogger(__name__)


class InkscapeTool(ExternalTool):
    """
    Wrapper for Inkscape CLI.
    
    Provides SVG optimization, rendering to raster formats, and SVG manipulation.
    Falls back gracefully if Inkscape is not installed.
    
    Inkscape CLI supports:
    - SVG to PNG/PDF/PS/EPS conversion
    - SVG optimization and cleanup
    - Object manipulation and extraction
    - Text to path conversion
    """
    
    def __init__(self):
        """Initialize Inkscape tool wrapper."""
        super().__init__("inkscape")
    
    def is_available(self) -> bool:
        """
        Check if Inkscape is installed and accessible.
        
        Returns:
            True if Inkscape is available, False otherwise
        """
        if self._available is not None:
            return self._available
        
        self._available = self._find_executable() is not None
        return self._available
    
    def get_version(self) -> str:
        """
        Get Inkscape version string.
        
        Returns:
            Version string (e.g., "1.2.2") or "unknown" if unavailable
        """
        if self._version is not None:
            return self._version
        
        if not self.is_available():
            return "unknown"
        
        try:
            # Run version command
            command = [str(self._executable_path), "--version"]
            result = self._run_command(command, timeout=5)
            
            # Parse version from output (e.g., "Inkscape 1.2.2 (b0a8486541, 2022-12-01)")
            version_match = re.search(r'Inkscape\s+([\d.]+)', result.stdout)
            if version_match:
                self._version = version_match.group(1)
            else:
                self._version = "unknown"
            
            return self._version
        except Exception as e:
            logger.error(f"Failed to get Inkscape version: {e}")
            return "unknown"
    
    def execute(self, command: List[str], input_path: Optional[str] = None,
                output_path: Optional[str] = None, **kwargs) -> bool:
        """
        Execute an Inkscape command.
        
        Args:
            command: Command arguments (without executable name)
            input_path: Optional input file path
            output_path: Optional output file path
            **kwargs: Additional parameters (timeout, etc.)
            
        Returns:
            True if execution succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("Inkscape is not available")
            return False
        
        # Validate input file if provided
        if input_path and not self._validate_file_exists(input_path, "Input SVG"):
            return False
        
        # Ensure output directory exists if output path provided
        if output_path and not self._ensure_output_directory(output_path):
            return False
        
        # Build full command
        full_command = [str(self._executable_path)]
        full_command.extend(command)
        
        try:
            timeout = kwargs.get('timeout', 60)
            self._run_command(full_command, timeout=timeout)
            return True
        except Exception as e:
            logger.error(f"Inkscape command failed: {e}")
            return False
    
    def optimize_svg(self, input_path: str, output_path: str,
                     options: Optional[Dict[str, Any]] = None) -> bool:
        """
        Optimize SVG file by cleaning up and reducing file size.
        
        Args:
            input_path: Path to input SVG file
            output_path: Path to output optimized SVG file
            options: Optional optimization options:
                - vacuum_defs: Remove unused definitions (bool, default True)
                - convert_text_to_path: Convert text to paths (bool, default False)
                - remove_metadata: Remove metadata (bool, default True)
                - simplify: Simplify paths (bool, default False)
                
        Returns:
            True if optimization succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("Inkscape is not available for SVG optimization")
            return False
        
        options = options or {}
        command = []
        
        # Input file
        command.extend([input_path])
        
        # Optimization options
        if options.get('vacuum_defs', True):
            command.append('--vacuum-defs')
        
        if options.get('convert_text_to_path', False):
            command.append('--export-text-to-path')
        
        if options.get('simplify', False):
            # Note: Inkscape doesn't have a direct simplify flag in CLI
            # This would need to be done through actions
            logger.warning("Path simplification not directly supported via CLI")
        
        # Output file
        command.extend(['--export-filename', output_path])
        
        # Export as plain SVG (removes Inkscape-specific elements)
        command.append('--export-plain-svg')
        
        return self.execute(command, input_path, output_path)
    
    def svg_to_png(self, svg_path: str, png_path: str,
                   width: Optional[int] = None, height: Optional[int] = None,
                   dpi: Optional[int] = None, background: Optional[str] = None) -> bool:
        """
        Render SVG to PNG with specified dimensions.
        
        Args:
            svg_path: Path to input SVG file
            png_path: Path to output PNG file
            width: Output width in pixels (optional)
            height: Output height in pixels (optional)
            dpi: Output DPI (optional, default 96)
            background: Background color (optional, e.g., "#ffffff" or "white")
            
        Returns:
            True if rendering succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("Inkscape is not available for SVG to PNG conversion")
            return False
        
        command = []
        
        # Input file
        command.extend([svg_path])
        
        # Dimensions
        if width is not None:
            command.extend(['--export-width', str(width)])
        
        if height is not None:
            command.extend(['--export-height', str(height)])
        
        # DPI
        if dpi is not None:
            command.extend(['--export-dpi', str(dpi)])
        
        # Background color
        if background is not None:
            command.extend(['--export-background', background])
            command.append('--export-background-opacity=1.0')
        
        # Output file
        command.extend(['--export-filename', png_path])
        
        # Export type
        command.append('--export-type=png')
        
        return self.execute(command, svg_path, png_path)
    
    def svg_to_pdf(self, svg_path: str, pdf_path: str,
                   options: Optional[Dict[str, Any]] = None) -> bool:
        """
        Convert SVG to PDF.
        
        Args:
            svg_path: Path to input SVG file
            pdf_path: Path to output PDF file
            options: Optional conversion options:
                - text_to_path: Convert text to paths (bool, default False)
                - dpi: Output DPI (int, default 96)
                
        Returns:
            True if conversion succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("Inkscape is not available for SVG to PDF conversion")
            return False
        
        options = options or {}
        command = []
        
        # Input file
        command.extend([svg_path])
        
        # Options
        if options.get('text_to_path', False):
            command.append('--export-text-to-path')
        
        if 'dpi' in options:
            command.extend(['--export-dpi', str(options['dpi'])])
        
        # Output file
        command.extend(['--export-filename', pdf_path])
        
        # Export type
        command.append('--export-type=pdf')
        
        return self.execute(command, svg_path, pdf_path)
    
    def extract_object(self, svg_path: str, output_path: str,
                       object_id: str, export_format: str = 'png') -> bool:
        """
        Extract a specific object from SVG by ID.
        
        Args:
            svg_path: Path to input SVG file
            output_path: Path to output file
            object_id: ID of the object to extract
            export_format: Output format (png, svg, pdf)
            
        Returns:
            True if extraction succeeded, False otherwise
        """
        if not self.is_available():
            logger.error("Inkscape is not available for object extraction")
            return False
        
        command = []
        
        # Input file
        command.extend([svg_path])
        
        # Object ID
        command.extend(['--export-id', object_id])
        command.append('--export-id-only')
        
        # Output file
        command.extend(['--export-filename', output_path])
        
        # Export type
        command.extend(['--export-type', export_format])
        
        return self.execute(command, svg_path, output_path)
    
    def batch_svg_to_png(self, svg_paths: List[str], output_dir: str,
                         width: Optional[int] = None, height: Optional[int] = None,
                         dpi: Optional[int] = None) -> Dict[str, bool]:
        """
        Batch convert SVG files to PNG.
        
        Args:
            svg_paths: List of input SVG file paths
            output_dir: Output directory for PNG files
            width: Output width in pixels (optional)
            height: Output height in pixels (optional)
            dpi: Output DPI (optional)
            
        Returns:
            Dictionary mapping input paths to success status
        """
        results = {}
        output_path_obj = Path(output_dir)
        output_path_obj.mkdir(parents=True, exist_ok=True)
        
        for svg_path in svg_paths:
            svg_path_obj = Path(svg_path)
            png_path = output_path_obj / svg_path_obj.with_suffix('.png').name
            
            success = self.svg_to_png(
                str(svg_path),
                str(png_path),
                width=width,
                height=height,
                dpi=dpi
            )
            results[svg_path] = success
        
        return results
    
    def get_svg_info(self, svg_path: str) -> Optional[Dict[str, Any]]:
        """
        Get information about an SVG file.
        
        Args:
            svg_path: Path to SVG file
            
        Returns:
            Dictionary with SVG information (width, height, viewBox) or None on error
        """
        if not self.is_available():
            logger.error("Inkscape is not available for SVG info query")
            return None
        
        try:
            # Query SVG dimensions
            command = [
                str(self._executable_path),
                svg_path,
                '--query-all'
            ]
            
            result = self._run_command(command, timeout=10)
            
            # Parse output (format: id,x,y,width,height)
            info = {}
            for line in result.stdout.strip().split('\n'):
                if line.startswith('svg,'):
                    parts = line.split(',')
                    if len(parts) >= 5:
                        info['x'] = float(parts[1])
                        info['y'] = float(parts[2])
                        info['width'] = float(parts[3])
                        info['height'] = float(parts[4])
                        break
            
            return info if info else None
        except Exception as e:
            logger.error(f"Failed to get SVG info: {e}")
            return None
