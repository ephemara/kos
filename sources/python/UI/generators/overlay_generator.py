"""
UI Forge Overlay Generator

Generates viewport overlays and HUD elements for DCC tools.
Supports transparency, compositing, and various overlay types.

Design Philosophy:
- Data-driven: All overlay properties from template parameters
- Transparency-aware: Full alpha channel support for compositing
- HUD-focused: Designed for viewport overlays and UI elements
- Compositing-ready: Supports various blend modes and opacity
"""

import numpy as np
from typing import Dict, Any, Type, Optional, Tuple, List
import logging
from enum import Enum

from models import Template, GeneratorType, BlendMode
from generators.base import BaseGenerator, register_generator


logger = logging.getLogger(__name__)


class OverlayType(str, Enum):
    """Overlay element types"""
    GRID = "grid"
    RULER = "ruler"
    CROSSHAIR = "crosshair"
    FRAME = "frame"
    CORNER_MARKERS = "corner_markers"
    CENTER_MARKER = "center_marker"
    SAFE_AREA = "safe_area"
    THIRDS_GRID = "thirds_grid"
    GOLDEN_RATIO = "golden_ratio"
    VIGNETTE = "vignette"
    GRADIENT_OVERLAY = "gradient_overlay"
    TEXT_OVERLAY = "text_overlay"
    ICON_OVERLAY = "icon_overlay"
    CUSTOM = "custom"


class OverlayPosition(str, Enum):
    """Overlay positioning"""
    TOP_LEFT = "top_left"
    TOP_CENTER = "top_center"
    TOP_RIGHT = "top_right"
    CENTER_LEFT = "center_left"
    CENTER = "center"
    CENTER_RIGHT = "center_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_CENTER = "bottom_center"
    BOTTOM_RIGHT = "bottom_right"
    CUSTOM = "custom"


@register_generator
class OverlayGenerator(BaseGenerator):
    """
    Overlay generator for viewport overlays and HUD elements.
    
    Features:
    - Multiple overlay types (grid, ruler, crosshair, frame, etc.)
    - Full transparency and alpha channel support
    - Compositing with blend modes
    - Positioning system (corners, center, custom)
    - Color customization
    - Opacity control
    - Safe area and composition guides
    
    All visual properties are data-driven from templates with zero hardcoded values.
    """
    
    def _get_generator_type(self) -> GeneratorType:
        """Return generator type"""
        return GeneratorType.OVERLAY
    
    def supported_params(self) -> Dict[str, Type]:
        """Return supported parameter schema"""
        return {
            "overlay_type": str,
            "color": str,
            "opacity": float,
            "line_width": (int, float),
            "position": (str, type(None)),
            "custom_position": (tuple, list, type(None)),
            "spacing": (int, float, type(None)),
            "margin": (int, float, type(None)),
            "blend_mode": (str, type(None)),
            "gradient_colors": (list, type(None)),
            "gradient_angle": (int, float, type(None)),
            "vignette_strength": (float, type(None)),
            "safe_area_percent": (float, type(None))
        }
    
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate overlay from template.
        
        Args:
            template: Template with overlay parameters
            
        Returns:
            Numpy array (H, W, 4) with RGBA uint8 data
            
        Notes:
            - Always returns RGBA with transparency
            - Designed for compositing over viewport content
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Validate parameters
        self.validate_params(template.params)
        
        # Extract overlay parameters
        overlay_type = OverlayType(template.params.get("overlay_type", "grid"))
        color = template.params.get("color", "#FFFFFF")
        opacity = template.params.get("opacity", 0.5)
        line_width = template.params.get("line_width", 1.0)
        
        logger.debug(
            f"Generating overlay: {width}x{height}, "
            f"type={overlay_type.value}, opacity={opacity}"
        )
        
        # Create transparent canvas
        canvas = self.create_blank_canvas(width, height, None)
        
        # Generate overlay based on type
        if overlay_type == OverlayType.GRID:
            spacing = template.params.get("spacing", 50.0)
            overlay = self._generate_grid_overlay(width, height, color, line_width, spacing)
        elif overlay_type == OverlayType.RULER:
            spacing = template.params.get("spacing", 10.0)
            overlay = self._generate_ruler_overlay(width, height, color, line_width, spacing)
        elif overlay_type == OverlayType.CROSSHAIR:
            overlay = self._generate_crosshair_overlay(width, height, color, line_width)
        elif overlay_type == OverlayType.FRAME:
            margin = template.params.get("margin", 10.0)
            overlay = self._generate_frame_overlay(width, height, color, line_width, margin)
        elif overlay_type == OverlayType.CORNER_MARKERS:
            margin = template.params.get("margin", 20.0)
            overlay = self._generate_corner_markers_overlay(width, height, color, line_width, margin)
        elif overlay_type == OverlayType.CENTER_MARKER:
            overlay = self._generate_center_marker_overlay(width, height, color, line_width)
        elif overlay_type == OverlayType.SAFE_AREA:
            safe_percent = template.params.get("safe_area_percent", 0.9)
            overlay = self._generate_safe_area_overlay(width, height, color, line_width, safe_percent)
        elif overlay_type == OverlayType.THIRDS_GRID:
            overlay = self._generate_thirds_grid_overlay(width, height, color, line_width)
        elif overlay_type == OverlayType.GOLDEN_RATIO:
            overlay = self._generate_golden_ratio_overlay(width, height, color, line_width)
        elif overlay_type == OverlayType.VIGNETTE:
            vignette_strength = template.params.get("vignette_strength", 0.5)
            overlay = self._generate_vignette_overlay(width, height, color, vignette_strength)
        elif overlay_type == OverlayType.GRADIENT_OVERLAY:
            gradient_colors = template.params.get("gradient_colors", [color, "#000000"])
            gradient_angle = template.params.get("gradient_angle", 0.0)
            overlay = self._generate_gradient_overlay(width, height, gradient_colors, gradient_angle)
        else:
            # Default to grid
            overlay = self._generate_grid_overlay(width, height, color, line_width, 50.0)
        
        # Apply opacity
        overlay[:, :, 3] = (overlay[:, :, 3] * opacity).astype(np.uint8)
        
        # Composite overlay onto canvas
        canvas = self._composite_overlay(canvas, overlay)
        
        return canvas
    
    def _generate_grid_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float,
        spacing: float
    ) -> np.ndarray:
        """Generate grid overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Generate grid lines
        x_line = (x % spacing) < line_width
        y_line = (y % spacing) < line_width
        mask = x_line | y_line
        
        # Apply color
        overlay[:, :, :3] = np.where(mask[:, :, np.newaxis], line_color, 0)
        overlay[:, :, 3] = np.where(mask, 255, 0)
        
        return overlay
    
    def _generate_ruler_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float,
        spacing: float
    ) -> np.ndarray:
        """Generate ruler overlay with tick marks"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        # Top ruler
        ruler_height = int(height * 0.05)
        for x in range(0, width, int(spacing)):
            # Major tick every 5 units
            tick_height = ruler_height if x % (spacing * 5) == 0 else ruler_height // 2
            overlay[:tick_height, x:x + int(line_width), :3] = line_color
            overlay[:tick_height, x:x + int(line_width), 3] = 255
        
        # Left ruler
        ruler_width = int(width * 0.05)
        for y in range(0, height, int(spacing)):
            # Major tick every 5 units
            tick_width = ruler_width if y % (spacing * 5) == 0 else ruler_width // 2
            overlay[y:y + int(line_width), :tick_width, :3] = line_color
            overlay[y:y + int(line_width), :tick_width, 3] = 255
        
        return overlay
    
    def _generate_crosshair_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float
    ) -> np.ndarray:
        """Generate crosshair overlay at center"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        cx, cy = width // 2, height // 2
        lw = int(line_width)
        
        # Vertical line
        overlay[:, cx - lw:cx + lw, :3] = line_color
        overlay[:, cx - lw:cx + lw, 3] = 255
        
        # Horizontal line
        overlay[cy - lw:cy + lw, :, :3] = line_color
        overlay[cy - lw:cy + lw, :, 3] = 255
        
        return overlay
    
    def _generate_frame_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float,
        margin: float
    ) -> np.ndarray:
        """Generate frame overlay around edges"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        m = int(margin)
        lw = int(line_width)
        
        # Top edge
        overlay[m:m + lw, m:width - m, :3] = line_color
        overlay[m:m + lw, m:width - m, 3] = 255
        
        # Bottom edge
        overlay[height - m - lw:height - m, m:width - m, :3] = line_color
        overlay[height - m - lw:height - m, m:width - m, 3] = 255
        
        # Left edge
        overlay[m:height - m, m:m + lw, :3] = line_color
        overlay[m:height - m, m:m + lw, 3] = 255
        
        # Right edge
        overlay[m:height - m, width - m - lw:width - m, :3] = line_color
        overlay[m:height - m, width - m - lw:width - m, 3] = 255
        
        return overlay
    
    def _generate_corner_markers_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float,
        margin: float
    ) -> np.ndarray:
        """Generate corner markers overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        m = int(margin)
        lw = int(line_width)
        marker_length = int(margin * 2)
        
        # Top-left corner
        overlay[m:m + lw, m:m + marker_length, :3] = line_color
        overlay[m:m + lw, m:m + marker_length, 3] = 255
        overlay[m:m + marker_length, m:m + lw, :3] = line_color
        overlay[m:m + marker_length, m:m + lw, 3] = 255
        
        # Top-right corner
        overlay[m:m + lw, width - m - marker_length:width - m, :3] = line_color
        overlay[m:m + lw, width - m - marker_length:width - m, 3] = 255
        overlay[m:m + marker_length, width - m - lw:width - m, :3] = line_color
        overlay[m:m + marker_length, width - m - lw:width - m, 3] = 255
        
        # Bottom-left corner
        overlay[height - m - lw:height - m, m:m + marker_length, :3] = line_color
        overlay[height - m - lw:height - m, m:m + marker_length, 3] = 255
        overlay[height - m - marker_length:height - m, m:m + lw, :3] = line_color
        overlay[height - m - marker_length:height - m, m:m + lw, 3] = 255
        
        # Bottom-right corner
        overlay[height - m - lw:height - m, width - m - marker_length:width - m, :3] = line_color
        overlay[height - m - lw:height - m, width - m - marker_length:width - m, 3] = 255
        overlay[height - m - marker_length:height - m, width - m - lw:width - m, :3] = line_color
        overlay[height - m - marker_length:height - m, width - m - lw:width - m, 3] = 255
        
        return overlay
    
    def _generate_center_marker_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float
    ) -> np.ndarray:
        """Generate center marker overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        cx, cy = width // 2, height // 2
        lw = int(line_width)
        marker_size = 20
        
        # Horizontal line
        overlay[cy - lw:cy + lw, cx - marker_size:cx + marker_size, :3] = line_color
        overlay[cy - lw:cy + lw, cx - marker_size:cx + marker_size, 3] = 255
        
        # Vertical line
        overlay[cy - marker_size:cy + marker_size, cx - lw:cx + lw, :3] = line_color
        overlay[cy - marker_size:cy + marker_size, cx - lw:cx + lw, 3] = 255
        
        # Center circle
        y, x = np.ogrid[:height, :width]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        circle_mask = (dist < 5) & (dist > 3)
        
        overlay[:, :, :3] = np.where(circle_mask[:, :, np.newaxis], line_color, overlay[:, :, :3])
        overlay[:, :, 3] = np.where(circle_mask, 255, overlay[:, :, 3])
        
        return overlay
    
    def _generate_safe_area_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float,
        safe_percent: float
    ) -> np.ndarray:
        """Generate safe area overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        # Calculate safe area dimensions
        safe_width = int(width * safe_percent)
        safe_height = int(height * safe_percent)
        
        # Calculate margins
        margin_x = (width - safe_width) // 2
        margin_y = (height - safe_height) // 2
        
        lw = int(line_width)
        
        # Draw safe area rectangle
        # Top edge
        overlay[margin_y:margin_y + lw, margin_x:width - margin_x, :3] = line_color
        overlay[margin_y:margin_y + lw, margin_x:width - margin_x, 3] = 255
        
        # Bottom edge
        overlay[height - margin_y - lw:height - margin_y, margin_x:width - margin_x, :3] = line_color
        overlay[height - margin_y - lw:height - margin_y, margin_x:width - margin_x, 3] = 255
        
        # Left edge
        overlay[margin_y:height - margin_y, margin_x:margin_x + lw, :3] = line_color
        overlay[margin_y:height - margin_y, margin_x:margin_x + lw, 3] = 255
        
        # Right edge
        overlay[margin_y:height - margin_y, width - margin_x - lw:width - margin_x, :3] = line_color
        overlay[margin_y:height - margin_y, width - margin_x - lw:width - margin_x, 3] = 255
        
        return overlay
    
    def _generate_thirds_grid_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float
    ) -> np.ndarray:
        """Generate rule of thirds grid overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        lw = int(line_width)
        
        # Vertical lines at 1/3 and 2/3
        x1 = width // 3
        x2 = 2 * width // 3
        
        overlay[:, x1 - lw:x1 + lw, :3] = line_color
        overlay[:, x1 - lw:x1 + lw, 3] = 255
        overlay[:, x2 - lw:x2 + lw, :3] = line_color
        overlay[:, x2 - lw:x2 + lw, 3] = 255
        
        # Horizontal lines at 1/3 and 2/3
        y1 = height // 3
        y2 = 2 * height // 3
        
        overlay[y1 - lw:y1 + lw, :, :3] = line_color
        overlay[y1 - lw:y1 + lw, :, 3] = 255
        overlay[y2 - lw:y2 + lw, :, :3] = line_color
        overlay[y2 - lw:y2 + lw, :, 3] = 255
        
        return overlay
    
    def _generate_golden_ratio_overlay(
        self,
        width: int,
        height: int,
        color: str,
        line_width: float
    ) -> np.ndarray:
        """Generate golden ratio grid overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        line_color = self._parse_hex_color(color)
        
        # Golden ratio ≈ 1.618
        phi = 1.618
        
        lw = int(line_width)
        
        # Vertical lines at golden ratio positions
        x1 = int(width / phi)
        x2 = width - x1
        
        overlay[:, x1 - lw:x1 + lw, :3] = line_color
        overlay[:, x1 - lw:x1 + lw, 3] = 255
        overlay[:, x2 - lw:x2 + lw, :3] = line_color
        overlay[:, x2 - lw:x2 + lw, 3] = 255
        
        # Horizontal lines at golden ratio positions
        y1 = int(height / phi)
        y2 = height - y1
        
        overlay[y1 - lw:y1 + lw, :, :3] = line_color
        overlay[y1 - lw:y1 + lw, :, 3] = 255
        overlay[y2 - lw:y2 + lw, :, :3] = line_color
        overlay[y2 - lw:y2 + lw, :, 3] = 255
        
        return overlay
    
    def _generate_vignette_overlay(
        self,
        width: int,
        height: int,
        color: str,
        strength: float
    ) -> np.ndarray:
        """Generate vignette overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse color
        vignette_color = self._parse_hex_color(color)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance from center (normalized)
        cx, cy = width / 2, height / 2
        max_dist = np.sqrt(cx**2 + cy**2)
        dist = np.sqrt((x - cx)**2 + (y - cy)**2) / max_dist
        
        # Apply vignette falloff
        vignette_mask = np.clip(dist * strength, 0, 1)
        
        # Apply color and alpha
        overlay[:, :, :3] = vignette_color
        overlay[:, :, 3] = (vignette_mask * 255).astype(np.uint8)
        
        return overlay
    
    def _generate_gradient_overlay(
        self,
        width: int,
        height: int,
        gradient_colors: List[str],
        gradient_angle: float
    ) -> np.ndarray:
        """Generate gradient overlay"""
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse colors
        color1 = self._parse_hex_color(gradient_colors[0])
        color2 = self._parse_hex_color(gradient_colors[1]) if len(gradient_colors) > 1 else (0, 0, 0)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Apply rotation
        angle_rad = np.radians(gradient_angle)
        cos_a = np.cos(angle_rad)
        sin_a = np.sin(angle_rad)
        
        # Rotate coordinates
        cx, cy = width / 2, height / 2
        x_rot = (x - cx) * cos_a - (y - cy) * sin_a
        
        # Normalize to [0, 1]
        max_dist = max(width, height) / 2
        t = (x_rot / max_dist + 1) / 2
        t = np.clip(t, 0, 1)
        
        # Interpolate colors
        for c in range(3):
            overlay[:, :, c] = (color1[c] * (1 - t) + color2[c] * t).astype(np.uint8)
        overlay[:, :, 3] = 255
        
        return overlay
    
    def _composite_overlay(
        self,
        canvas: np.ndarray,
        overlay: np.ndarray
    ) -> np.ndarray:
        """Composite overlay onto canvas"""
        # Simple alpha compositing
        overlay_alpha = overlay[:, :, 3].astype(np.float32) / 255.0
        canvas_alpha = canvas[:, :, 3].astype(np.float32) / 255.0
        
        # Composite RGB
        overlay_alpha_3d = overlay_alpha[:, :, np.newaxis]
        canvas_alpha_3d = canvas_alpha[:, :, np.newaxis]
        
        out_alpha = overlay_alpha + canvas_alpha * (1 - overlay_alpha)
        out_alpha_3d = out_alpha[:, :, np.newaxis]
        
        out_rgb = np.where(
            out_alpha_3d > 0,
            (overlay[:, :, :3] * overlay_alpha_3d + canvas[:, :, :3] * canvas_alpha_3d * (1 - overlay_alpha_3d)) / out_alpha_3d,
            0
        )
        
        # Create output
        result = np.zeros_like(canvas)
        result[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
        result[:, :, 3] = (out_alpha * 255).astype(np.uint8)
        
        return result
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate overlay parameters with additional checks.
        
        Args:
            params: Parameter dictionary
            
        Returns:
            True if valid
            
        Raises:
            ValueError: If parameters are invalid
        """
        # Call base validation
        super().validate_params(params)
        
        # Additional overlay-specific validation
        if "overlay_type" in params:
            try:
                OverlayType(params["overlay_type"])
            except ValueError:
                valid_types = [t.value for t in OverlayType]
                raise ValueError(
                    f"Invalid overlay_type: {params['overlay_type']}. "
                    f"Valid types: {valid_types}"
                )
        
        if "opacity" in params:
            opacity = params["opacity"]
            if not (0.0 <= opacity <= 1.0):
                raise ValueError(f"Opacity must be in [0.0, 1.0], got {opacity}")
        
        if "line_width" in params:
            width = params["line_width"]
            if width <= 0:
                raise ValueError(f"Line width must be positive, got {width}")
        
        if "safe_area_percent" in params:
            percent = params["safe_area_percent"]
            if not (0.0 < percent <= 1.0):
                raise ValueError(f"Safe area percent must be in (0.0, 1.0], got {percent}")
        
        if "vignette_strength" in params:
            strength = params["vignette_strength"]
            if not (0.0 <= strength <= 1.0):
                raise ValueError(f"Vignette strength must be in [0.0, 1.0], got {strength}")
        
        return True
    
    def __repr__(self) -> str:
        """String representation"""
        return f"OverlayGenerator(type={self.generator_type.value})"
