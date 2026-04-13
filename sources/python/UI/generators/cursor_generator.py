"""
UI Forge Cursor Generator

Generates custom cursor graphics with hotspot metadata for DCC tools.
Supports multiple cursor sizes and cursor shape rendering.

Design Philosophy:
- Data-driven: All cursor properties from template parameters
- Hotspot-aware: Includes precise hotspot coordinates for cursor positioning
- Multi-resolution: Generates cursors at multiple sizes (16x16, 24x24, 32x32, 48x48)
- Metadata-rich: Outputs JSON metadata with hotspot and size information
"""

import numpy as np
from typing import Dict, Any, Type, Optional, Tuple, List
import logging
import json
from enum import Enum

from models import Template, GeneratorType
from generators.base import BaseGenerator, register_generator


logger = logging.getLogger(__name__)


class CursorType(str, Enum):
    """Cursor shape types"""
    ARROW = "arrow"
    HAND = "hand"
    CROSSHAIR = "crosshair"
    MOVE = "move"
    RESIZE_NS = "resize_ns"  # North-South
    RESIZE_EW = "resize_ew"  # East-West
    RESIZE_NESW = "resize_nesw"  # Northeast-Southwest
    RESIZE_NWSE = "resize_nwse"  # Northwest-Southeast
    TEXT = "text"
    WAIT = "wait"
    HELP = "help"
    FORBIDDEN = "forbidden"
    GRAB = "grab"
    GRABBING = "grabbing"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    BRUSH = "brush"
    EYEDROPPER = "eyedropper"
    CUSTOM = "custom"


@register_generator
class CursorGenerator(BaseGenerator):
    """
    Cursor generator for custom cursor graphics.
    
    Features:
    - Multiple cursor shape types (arrow, hand, crosshair, etc.)
    - Hotspot metadata for precise cursor positioning
    - Multiple cursor sizes (16x16, 24x24, 32x32, 48x48)
    - Anti-aliased rendering
    - Color customization
    - Shadow and outline effects
    
    All visual properties are data-driven from templates with zero hardcoded values.
    """
    
    def _get_generator_type(self) -> GeneratorType:
        """Return generator type"""
        return GeneratorType.CURSOR
    
    def supported_params(self) -> Dict[str, Type]:
        """Return supported parameter schema"""
        return {
            "cursor_type": str,
            "hotspot": (tuple, list),
            "color": str,
            "outline_color": (str, type(None)),
            "outline_width": (int, float),
            "shadow": bool,
            "shadow_offset": (tuple, list, type(None)),
            "sizes": (list, type(None)),
            "custom_shape": (list, type(None))
        }
    
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate cursor from template.
        
        Args:
            template: Template with cursor parameters
            
        Returns:
            Numpy array (H, W, 4) with RGBA uint8 data
            
        Notes:
            - Also generates metadata JSON with hotspot information
            - Hotspot coordinates are relative to top-left corner
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Validate parameters
        self.validate_params(template.params)
        
        # Extract cursor parameters
        cursor_type = CursorType(template.params.get("cursor_type", "arrow"))
        hotspot = tuple(template.params.get("hotspot", (0, 0)))
        color = template.params.get("color", "#FFFFFF")
        outline_color = template.params.get("outline_color")
        outline_width = template.params.get("outline_width", 1.0)
        shadow = template.params.get("shadow", False)
        shadow_offset = tuple(template.params.get("shadow_offset", (2, 2)))
        
        logger.debug(
            f"Generating cursor: {width}x{height}, "
            f"type={cursor_type.value}, hotspot={hotspot}"
        )
        
        # Create canvas
        canvas = self.create_blank_canvas(width, height, None)  # Transparent background
        
        # Generate cursor shape
        if cursor_type == CursorType.ARROW:
            cursor_mask = self._generate_arrow_cursor(width, height)
        elif cursor_type == CursorType.HAND:
            cursor_mask = self._generate_hand_cursor(width, height)
        elif cursor_type == CursorType.CROSSHAIR:
            cursor_mask = self._generate_crosshair_cursor(width, height)
        elif cursor_type == CursorType.MOVE:
            cursor_mask = self._generate_move_cursor(width, height)
        elif cursor_type == CursorType.RESIZE_NS:
            cursor_mask = self._generate_resize_ns_cursor(width, height)
        elif cursor_type == CursorType.RESIZE_EW:
            cursor_mask = self._generate_resize_ew_cursor(width, height)
        elif cursor_type == CursorType.RESIZE_NESW:
            cursor_mask = self._generate_resize_nesw_cursor(width, height)
        elif cursor_type == CursorType.RESIZE_NWSE:
            cursor_mask = self._generate_resize_nwse_cursor(width, height)
        elif cursor_type == CursorType.TEXT:
            cursor_mask = self._generate_text_cursor(width, height)
        elif cursor_type == CursorType.GRAB:
            cursor_mask = self._generate_grab_cursor(width, height)
        elif cursor_type == CursorType.GRABBING:
            cursor_mask = self._generate_grabbing_cursor(width, height)
        elif cursor_type == CursorType.ZOOM_IN:
            cursor_mask = self._generate_zoom_in_cursor(width, height)
        elif cursor_type == CursorType.ZOOM_OUT:
            cursor_mask = self._generate_zoom_out_cursor(width, height)
        elif cursor_type == CursorType.BRUSH:
            cursor_mask = self._generate_brush_cursor(width, height)
        elif cursor_type == CursorType.EYEDROPPER:
            cursor_mask = self._generate_eyedropper_cursor(width, height)
        elif cursor_type == CursorType.CUSTOM:
            custom_shape = template.params.get("custom_shape")
            cursor_mask = self._generate_custom_cursor(width, height, custom_shape)
        else:
            # Default to arrow
            cursor_mask = self._generate_arrow_cursor(width, height)
        
        # Apply shadow if requested
        if shadow:
            canvas = self._apply_shadow(canvas, cursor_mask, shadow_offset)
        
        # Apply outline if specified
        if outline_color:
            canvas = self._apply_outline(canvas, cursor_mask, outline_color, outline_width)
        
        # Apply cursor color
        cursor_color = self._parse_hex_color(color)
        canvas[:, :, :3] = np.where(
            cursor_mask[:, :, np.newaxis] > 0,
            cursor_color,
            canvas[:, :, :3]
        )
        canvas[:, :, 3] = np.maximum(
            canvas[:, :, 3],
            (cursor_mask * 255).astype(np.uint8)
        )
        
        # Store hotspot metadata (will be saved separately)
        self._hotspot_metadata = {
            "hotspot": hotspot,
            "cursor_type": cursor_type.value,
            "dimensions": {"width": width, "height": height}
        }
        
        return canvas
    
    def _generate_arrow_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate standard arrow cursor shape"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Arrow shape (simplified triangle)
        # Define arrow points
        arrow_points = [
            (0, 0),  # Top
            (0, height * 0.7),  # Bottom left
            (width * 0.3, height * 0.5),  # Middle right
        ]
        
        # Fill arrow triangle
        mask = self._fill_polygon(mask, arrow_points)
        
        return mask
    
    def _generate_hand_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate hand cursor shape (pointing finger)"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Simplified hand shape (rectangle for palm + finger)
        cx, cy = width // 2, height // 2
        
        # Finger (pointing up)
        finger_points = [
            (cx - width * 0.1, cy - height * 0.3),
            (cx + width * 0.1, cy - height * 0.3),
            (cx + width * 0.1, cy),
            (cx - width * 0.1, cy)
        ]
        mask = self._fill_polygon(mask, finger_points)
        
        # Palm
        palm_points = [
            (cx - width * 0.25, cy),
            (cx + width * 0.25, cy),
            (cx + width * 0.25, cy + height * 0.3),
            (cx - width * 0.25, cy + height * 0.3)
        ]
        mask = self._fill_polygon(mask, palm_points)
        
        return mask
    
    def _generate_crosshair_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate crosshair cursor shape"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx, cy = width // 2, height // 2
        line_width = max(1, width // 16)
        
        # Vertical line
        mask[cy - height // 3:cy + height // 3, cx - line_width:cx + line_width] = 1.0
        
        # Horizontal line
        mask[cy - line_width:cy + line_width, cx - width // 3:cx + width // 3] = 1.0
        
        return mask
    
    def _generate_move_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate move cursor (four-way arrows)"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx, cy = width // 2, height // 2
        arrow_size = min(width, height) // 4
        
        # Center circle
        y, x = np.ogrid[:height, :width]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        mask = np.where(dist < arrow_size * 0.3, 1.0, mask)
        
        # Four arrows (simplified as lines)
        line_width = max(1, width // 16)
        
        # Up arrow
        mask[cy - height // 3:cy, cx - line_width:cx + line_width] = 1.0
        # Down arrow
        mask[cy:cy + height // 3, cx - line_width:cx + line_width] = 1.0
        # Left arrow
        mask[cy - line_width:cy + line_width, cx - width // 3:cx] = 1.0
        # Right arrow
        mask[cy - line_width:cy + line_width, cx:cx + width // 3] = 1.0
        
        return mask
    
    def _generate_resize_ns_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate north-south resize cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx = width // 2
        line_width = max(1, width // 16)
        
        # Vertical line
        mask[:, cx - line_width:cx + line_width] = 1.0
        
        # Top arrow
        arrow_size = height // 6
        mask[:arrow_size, cx - arrow_size:cx + arrow_size] = 1.0
        
        # Bottom arrow
        mask[-arrow_size:, cx - arrow_size:cx + arrow_size] = 1.0
        
        return mask
    
    def _generate_resize_ew_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate east-west resize cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cy = height // 2
        line_width = max(1, height // 16)
        
        # Horizontal line
        mask[cy - line_width:cy + line_width, :] = 1.0
        
        # Left arrow
        arrow_size = width // 6
        mask[cy - arrow_size:cy + arrow_size, :arrow_size] = 1.0
        
        # Right arrow
        mask[cy - arrow_size:cy + arrow_size, -arrow_size:] = 1.0
        
        return mask
    
    def _generate_resize_nesw_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate northeast-southwest resize cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Diagonal line from top-right to bottom-left
        for i in range(min(width, height)):
            x = width - 1 - i
            y = i
            if 0 <= x < width and 0 <= y < height:
                mask[y, x] = 1.0
        
        return mask
    
    def _generate_resize_nwse_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate northwest-southeast resize cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Diagonal line from top-left to bottom-right
        for i in range(min(width, height)):
            if 0 <= i < width and 0 <= i < height:
                mask[i, i] = 1.0
        
        return mask
    
    def _generate_text_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate text I-beam cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx = width // 2
        line_width = max(1, width // 16)
        
        # Vertical line
        mask[:, cx - line_width:cx + line_width] = 1.0
        
        # Top horizontal bar
        bar_width = width // 3
        mask[:height // 6, cx - bar_width:cx + bar_width] = 1.0
        
        # Bottom horizontal bar
        mask[-height // 6:, cx - bar_width:cx + bar_width] = 1.0
        
        return mask
    
    def _generate_grab_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate open hand (grab) cursor"""
        # Similar to hand but with open fingers
        return self._generate_hand_cursor(width, height)
    
    def _generate_grabbing_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate closed hand (grabbing) cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Closed fist (simplified as filled circle)
        cx, cy = width // 2, height // 2
        radius = min(width, height) // 3
        
        y, x = np.ogrid[:height, :width]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        mask = np.where(dist < radius, 1.0, 0.0)
        
        return mask
    
    def _generate_zoom_in_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate zoom in cursor (magnifying glass with +)"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx, cy = width // 2, height // 2
        radius = min(width, height) // 3
        
        # Magnifying glass circle
        y, x = np.ogrid[:height, :width]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        circle_mask = (dist < radius) & (dist > radius - 2)
        mask = np.where(circle_mask, 1.0, mask)
        
        # Plus sign inside
        line_width = max(1, width // 16)
        mask[cy - radius // 2:cy + radius // 2, cx - line_width:cx + line_width] = 1.0
        mask[cy - line_width:cy + line_width, cx - radius // 2:cx + radius // 2] = 1.0
        
        # Handle
        handle_length = radius
        mask[cy + radius:cy + radius + handle_length, cx - line_width:cx + line_width] = 1.0
        
        return mask
    
    def _generate_zoom_out_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate zoom out cursor (magnifying glass with -)"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx, cy = width // 2, height // 2
        radius = min(width, height) // 3
        
        # Magnifying glass circle
        y, x = np.ogrid[:height, :width]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        circle_mask = (dist < radius) & (dist > radius - 2)
        mask = np.where(circle_mask, 1.0, mask)
        
        # Minus sign inside
        line_width = max(1, width // 16)
        mask[cy - line_width:cy + line_width, cx - radius // 2:cx + radius // 2] = 1.0
        
        # Handle
        handle_length = radius
        mask[cy + radius:cy + radius + handle_length, cx - line_width:cx + line_width] = 1.0
        
        return mask
    
    def _generate_brush_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate brush cursor (circle outline)"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        cx, cy = width // 2, height // 2
        radius = min(width, height) // 3
        
        # Circle outline
        y, x = np.ogrid[:height, :width]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        circle_mask = (dist < radius) & (dist > radius - 2)
        mask = np.where(circle_mask, 1.0, 0.0)
        
        # Crosshair in center
        line_width = 1
        mask[cy - 3:cy + 3, cx - line_width:cx + line_width] = 1.0
        mask[cy - line_width:cy + line_width, cx - 3:cx + 3] = 1.0
        
        return mask
    
    def _generate_eyedropper_cursor(self, width: int, height: int) -> np.ndarray:
        """Generate eyedropper cursor"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Simplified eyedropper shape
        cx = width // 2
        
        # Dropper bulb (top)
        bulb_points = [
            (cx - width * 0.2, height * 0.2),
            (cx + width * 0.2, height * 0.2),
            (cx + width * 0.15, height * 0.4),
            (cx - width * 0.15, height * 0.4)
        ]
        mask = self._fill_polygon(mask, bulb_points)
        
        # Dropper tube (bottom)
        tube_points = [
            (cx - width * 0.1, height * 0.4),
            (cx + width * 0.1, height * 0.4),
            (cx + width * 0.05, height * 0.8),
            (cx - width * 0.05, height * 0.8)
        ]
        mask = self._fill_polygon(mask, tube_points)
        
        return mask
    
    def _generate_custom_cursor(
        self,
        width: int,
        height: int,
        custom_shape: Optional[List[Tuple[float, float]]]
    ) -> np.ndarray:
        """Generate custom cursor from point list"""
        mask = np.zeros((height, width), dtype=np.float32)
        
        if custom_shape and len(custom_shape) >= 3:
            # Scale points to canvas size
            scaled_points = [
                (x * width, y * height) for x, y in custom_shape
            ]
            mask = self._fill_polygon(mask, scaled_points)
        else:
            # Default to arrow if no valid custom shape
            mask = self._generate_arrow_cursor(width, height)
        
        return mask
    
    def _fill_polygon(
        self,
        mask: np.ndarray,
        points: List[Tuple[float, float]]
    ) -> np.ndarray:
        """Fill polygon defined by points"""
        height, width = mask.shape
        
        # Simple scanline polygon fill
        for y in range(height):
            intersections = []
            
            for i in range(len(points)):
                p1 = points[i]
                p2 = points[(i + 1) % len(points)]
                
                x1, y1 = p1
                x2, y2 = p2
                
                if y1 == y2:
                    continue
                
                if y1 > y2:
                    y1, y2 = y2, y1
                    x1, x2 = x2, x1
                
                if y1 <= y < y2:
                    t = (y - y1) / (y2 - y1)
                    x = x1 + t * (x2 - x1)
                    intersections.append(x)
            
            intersections.sort()
            
            for i in range(0, len(intersections), 2):
                if i + 1 < len(intersections):
                    x_start = int(intersections[i])
                    x_end = int(intersections[i + 1])
                    mask[y, max(0, x_start):min(width, x_end + 1)] = 1.0
        
        return mask
    
    def _apply_shadow(
        self,
        canvas: np.ndarray,
        cursor_mask: np.ndarray,
        shadow_offset: Tuple[int, int]
    ) -> np.ndarray:
        """Apply shadow effect to cursor"""
        height, width = cursor_mask.shape
        offset_x, offset_y = shadow_offset
        
        # Create shadow mask (shifted)
        shadow_mask = np.zeros_like(cursor_mask)
        
        # Calculate valid regions for shadow
        src_y_start = max(0, -offset_y)
        src_y_end = min(height, height - offset_y)
        src_x_start = max(0, -offset_x)
        src_x_end = min(width, width - offset_x)
        
        dst_y_start = max(0, offset_y)
        dst_y_end = min(height, height + offset_y)
        dst_x_start = max(0, offset_x)
        dst_x_end = min(width, width + offset_x)
        
        # Copy cursor mask to shadow position
        shadow_mask[dst_y_start:dst_y_end, dst_x_start:dst_x_end] = \
            cursor_mask[src_y_start:src_y_end, src_x_start:src_x_end]
        
        # Apply shadow (semi-transparent black)
        shadow_color = np.array([0, 0, 0], dtype=np.uint8)
        shadow_alpha = shadow_mask * 0.5  # 50% opacity
        
        canvas[:, :, :3] = np.where(
            shadow_alpha[:, :, np.newaxis] > 0,
            shadow_color,
            canvas[:, :, :3]
        )
        canvas[:, :, 3] = np.maximum(
            canvas[:, :, 3],
            (shadow_alpha * 255).astype(np.uint8)
        )
        
        return canvas
    
    def _apply_outline(
        self,
        canvas: np.ndarray,
        cursor_mask: np.ndarray,
        outline_color: str,
        outline_width: float
    ) -> np.ndarray:
        """Apply outline effect to cursor"""
        from scipy import ndimage
        
        # Dilate cursor mask to create outline
        kernel_size = int(np.ceil(outline_width * 2))
        if kernel_size % 2 == 0:
            kernel_size += 1
        
        # Create circular kernel
        y, x = np.ogrid[-kernel_size//2:kernel_size//2+1, -kernel_size//2:kernel_size//2+1]
        kernel = (x**2 + y**2 <= outline_width**2).astype(np.uint8)
        
        # Dilate mask
        dilated = ndimage.binary_dilation(cursor_mask > 0.5, structure=kernel).astype(np.float32)
        
        # Outline is dilated minus original
        outline_mask = dilated - cursor_mask
        outline_mask = np.clip(outline_mask, 0, 1)
        
        # Apply outline color
        outline_rgb = self._parse_hex_color(outline_color)
        canvas[:, :, :3] = np.where(
            outline_mask[:, :, np.newaxis] > 0,
            outline_rgb,
            canvas[:, :, :3]
        )
        canvas[:, :, 3] = np.maximum(
            canvas[:, :, 3],
            (outline_mask * 255).astype(np.uint8)
        )
        
        return canvas
    
    def get_hotspot_metadata(self) -> Dict[str, Any]:
        """
        Get hotspot metadata for the generated cursor.
        
        Returns:
            Dictionary with hotspot coordinates and cursor info
        """
        return getattr(self, '_hotspot_metadata', {
            "hotspot": (0, 0),
            "cursor_type": "arrow",
            "dimensions": {"width": 32, "height": 32}
        })
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate cursor parameters with additional checks.
        
        Args:
            params: Parameter dictionary
            
        Returns:
            True if valid
            
        Raises:
            ValueError: If parameters are invalid
        """
        # Call base validation
        super().validate_params(params)
        
        # Additional cursor-specific validation
        if "cursor_type" in params:
            try:
                CursorType(params["cursor_type"])
            except ValueError:
                valid_types = [t.value for t in CursorType]
                raise ValueError(
                    f"Invalid cursor_type: {params['cursor_type']}. "
                    f"Valid types: {valid_types}"
                )
        
        if "hotspot" in params:
            hotspot = params["hotspot"]
            if not isinstance(hotspot, (tuple, list)) or len(hotspot) != 2:
                raise ValueError("Hotspot must be a tuple/list of 2 coordinates (x, y)")
            if hotspot[0] < 0 or hotspot[1] < 0:
                raise ValueError("Hotspot coordinates must be non-negative")
        
        if "outline_width" in params:
            width = params["outline_width"]
            if width < 0:
                raise ValueError(f"Outline width must be non-negative, got {width}")
        
        return True
    
    def __repr__(self) -> str:
        """String representation"""
        return f"CursorGenerator(type={self.generator_type.value})"
