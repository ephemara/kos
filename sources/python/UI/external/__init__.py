"""
UI Forge External Tool Integration

Wrappers for external tools (ImageMagick, Inkscape, GIMP) with graceful degradation.
All external tools are optional - the system will function without them.

Available Wrappers:
- ImageMagickTool: Format conversion, compositing, effects
- InkscapeTool: SVG optimization and rendering
- GIMPTool: Batch processing for complex operations

Usage:
    from external import get_tool_manager
    
    manager = get_tool_manager()
    if manager.is_tool_available('imagemagick'):
        imagemagick = manager.get_tool('imagemagick')
        imagemagick.convert('input.png', 'output.jpg')
"""

import logging
from typing import Dict, Optional, Any

from .base import ExternalTool
from .imagemagick import ImageMagickTool
from .inkscape import InkscapeTool
from .gimp import GIMPTool

logger = logging.getLogger(__name__)

__all__ = [
    'ExternalTool',
    'ImageMagickTool',
    'InkscapeTool',
    'GIMPTool',
    'ExternalToolManager',
    'get_tool_manager'
]


class ExternalToolManager:
    """
    Manager for external tools with graceful degradation.
    
    Provides centralized access to external tools, checks availability at startup,
    and provides clear error messages when tools are missing.
    """
    
    def __init__(self):
        """Initialize external tool manager."""
        self._tools: Dict[str, ExternalTool] = {}
        self._initialized = False
    
    def initialize(self) -> None:
        """
        Initialize all external tools and check availability.
        
        This should be called at startup to detect available tools.
        """
        if self._initialized:
            return
        
        logger.info("Initializing external tool integration...")
        
        # Initialize ImageMagick
        try:
            imagemagick = ImageMagickTool()
            self._tools['imagemagick'] = imagemagick
            if imagemagick.is_available():
                logger.info(f"✓ ImageMagick {imagemagick.get_version()} detected")
            else:
                logger.warning("✗ ImageMagick not found - advanced format conversion unavailable")
        except Exception as e:
            logger.error(f"Failed to initialize ImageMagick: {e}")
        
        # Initialize Inkscape
        try:
            inkscape = InkscapeTool()
            self._tools['inkscape'] = inkscape
            if inkscape.is_available():
                logger.info(f"✓ Inkscape {inkscape.get_version()} detected")
            else:
                logger.warning("✗ Inkscape not found - SVG optimization unavailable")
        except Exception as e:
            logger.error(f"Failed to initialize Inkscape: {e}")
        
        # Initialize GIMP
        try:
            gimp = GIMPTool()
            self._tools['gimp'] = gimp
            if gimp.is_available():
                logger.info(f"✓ GIMP {gimp.get_version()} detected")
            else:
                logger.warning("✗ GIMP not found - advanced batch processing unavailable")
        except Exception as e:
            logger.error(f"Failed to initialize GIMP: {e}")
        
        self._initialized = True
        
        # Log summary
        available_count = sum(1 for tool in self._tools.values() if tool.is_available())
        total_count = len(self._tools)
        logger.info(f"External tools: {available_count}/{total_count} available")
    
    def is_tool_available(self, tool_name: str) -> bool:
        """
        Check if a specific tool is available.
        
        Args:
            tool_name: Name of the tool ('imagemagick', 'inkscape', 'gimp')
            
        Returns:
            True if tool is available, False otherwise
        """
        if not self._initialized:
            self.initialize()
        
        tool = self._tools.get(tool_name.lower())
        return tool.is_available() if tool else False
    
    def get_tool(self, tool_name: str) -> Optional[ExternalTool]:
        """
        Get a specific tool instance.
        
        Args:
            tool_name: Name of the tool ('imagemagick', 'inkscape', 'gimp')
            
        Returns:
            Tool instance or None if not available
        """
        if not self._initialized:
            self.initialize()
        
        tool = self._tools.get(tool_name.lower())
        if tool and tool.is_available():
            return tool
        
        logger.warning(f"Tool '{tool_name}' is not available")
        return None
    
    def get_available_tools(self) -> Dict[str, ExternalTool]:
        """
        Get all available tools.
        
        Returns:
            Dictionary of available tools
        """
        if not self._initialized:
            self.initialize()
        
        return {
            name: tool
            for name, tool in self._tools.items()
            if tool.is_available()
        }
    
    def get_tool_info(self) -> Dict[str, Dict[str, Any]]:
        """
        Get information about all tools.
        
        Returns:
            Dictionary with tool information
        """
        if not self._initialized:
            self.initialize()
        
        return {
            name: tool.get_info()
            for name, tool in self._tools.items()
        }
    
    def check_requirements(self, required_tools: list) -> tuple[bool, list]:
        """
        Check if required tools are available.
        
        Args:
            required_tools: List of required tool names
            
        Returns:
            Tuple of (all_available, missing_tools)
        """
        if not self._initialized:
            self.initialize()
        
        missing = []
        for tool_name in required_tools:
            if not self.is_tool_available(tool_name):
                missing.append(tool_name)
        
        return len(missing) == 0, missing
    
    def get_fallback_message(self, tool_name: str, operation: str) -> str:
        """
        Get a user-friendly fallback message for missing tools.
        
        Args:
            tool_name: Name of the missing tool
            operation: Operation that requires the tool
            
        Returns:
            User-friendly error message with installation instructions
        """
        messages = {
            'imagemagick': (
                f"ImageMagick is required for {operation}.\n"
                "Install ImageMagick:\n"
                "  - Windows: Download from https://imagemagick.org/script/download.php\n"
                "  - macOS: brew install imagemagick\n"
                "  - Linux: sudo apt-get install imagemagick\n"
                "Fallback: Using Pillow for basic operations."
            ),
            'inkscape': (
                f"Inkscape is required for {operation}.\n"
                "Install Inkscape:\n"
                "  - Windows: Download from https://inkscape.org/release/\n"
                "  - macOS: brew install inkscape\n"
                "  - Linux: sudo apt-get install inkscape\n"
                "Fallback: Using cairosvg for basic SVG rendering."
            ),
            'gimp': (
                f"GIMP is required for {operation}.\n"
                "Install GIMP:\n"
                "  - Windows: Download from https://www.gimp.org/downloads/\n"
                "  - macOS: brew install gimp\n"
                "  - Linux: sudo apt-get install gimp\n"
                "Fallback: Using Pillow/numpy for basic operations."
            )
        }
        
        return messages.get(tool_name.lower(), f"Tool '{tool_name}' is not available for {operation}.")


# Global tool manager instance
_tool_manager: Optional[ExternalToolManager] = None


def get_tool_manager() -> ExternalToolManager:
    """
    Get the global external tool manager instance.
    
    Returns:
        ExternalToolManager instance
    """
    global _tool_manager
    if _tool_manager is None:
        _tool_manager = ExternalToolManager()
        _tool_manager.initialize()
    return _tool_manager
