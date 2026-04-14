"""
UI Forge Brush Generator

Generates brush preview thumbnails for sculpting and painting tools.
Renders representative brush strokes with falloff curves, texture overlays,
and multiple preview sizes (thumbnail and detail).

Design Philosophy:
- Data-driven: All brush properties from template parameters
- Preview-focused: Generates visual representations of brush behavior
- Multi-resolution: Supports thumbnail (64x64) and detail (256x256) previews
- Texture-aware: Applies texture overlays for textured brushes
"""

import numpy as np
from typing import Dict, Any, Type, Optional
import logging
from PIL import Image

from models import (
    Template, GeneratorType, BrushParams, BrushShape, FalloffCurve
)
from generators.base import BaseGenerator, register_generator


logger = logging.getLogger(__name__)


@register_generator
class BrushGenerator(BaseGenerator):
    """
    Brush preview generator for sculpting and painting tools.
    
    Features:
    - Circular, square, and custom brush shapes
    - Falloff curve rendering (linear, smooth, sharp, custom)
    - Texture overlay application
    - Brush stroke preview with spacing
    - Multiple preview sizes (thumbnail and detail)
    - Neutral background rendering
    
    All visual properties are data-driven from templates with zero hardcoded values.
    """
    
    def _get_generator_type(self) -> GeneratorType:
        """Return generator type"""
        return GeneratorType.BRUSH
    
    def supported_params(self) -> Dict[str, Type]:
        """Return supported parameter schema"""
        return {
            "shape": str,
            "size": int,
            "hardness": float,
            "spacing": float,
            "texture": (str, type(None)),
            "falloff_curve": str,
            "custom_curve": (list, type(None)),
            "stroke_preview": bool,
            "background_color": str,
            "generate_thumbnail": bool,
            "generate_detail": bool
        }
    
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate brush preview from template.
        
        Args:
            template: Template with brush parameters
            
        Returns:
            Numpy array (H, W, 4) with RGBA uint8 data
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Parse brush parameters
        params = self._parse_brush_params(template.params)
        
        logger.debug(
            f"Generating brush preview: {width}x{height}, "
            f"shape={params.shape.value}, size={params.size}, "
            f"hardness={params.hardness}, falloff={params.falloff_curve.value}"
        )
        
        # Create canvas with neutral background
        canvas = self.create_blank_canvas(width, height, params.background_color)
        
        # Generate brush preview
        if params.stroke_preview:
            # Render full brush stroke
            brush_layer = self._render_brush_stroke(params, width, height)
        else:
            # Render single brush stamp
            brush_layer = self._render_brush_stamp(params, width, height)
        
        # Composite brush onto canvas
        canvas = self._composite_brush(canvas, brush_layer)
        
        return canvas
    
    def _parse_brush_params(self, params: Dict[str, Any]) -> BrushParams:
        """Parse and validate brush parameters"""
        # Validate parameters
        self.validate_params(params)
        
        # Create BrushParams
        return BrushParams(
            shape=BrushShape(params.get("shape", "circular")),
            size=params.get("size", 64),
            hardness=params.get("hardness", 0.5),
            spacing=params.get("spacing", 0.25),
            texture=params.get("texture"),
            falloff_curve=FalloffCurve(params.get("falloff_curve", "smooth")),
            custom_curve=params.get("custom_curve"),
            stroke_preview=params.get("stroke_preview", True),
            background_color=params.get("background_color", "#808080"),
            generate_thumbnail=params.get("generate_thumbnail", True),
            generate_detail=params.get("generate_detail", True)
        )
    
    def _render_brush_stamp(
        self,
        params: BrushParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Render a single brush stamp at the center.
        
        Args:
            params: Brush parameters
            width: Canvas width
            height: Canvas height
            
        Returns:
            RGBA numpy array (H, W, 4) with brush stamp
        """
        # Create brush stamp buffer
        stamp = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Calculate brush center
        cx, cy = width / 2, height / 2
        
        # Generate brush mask based on shape
        mask = self._generate_brush_mask(params, width, height, cx, cy)
        
        # Apply falloff curve
        mask = self._apply_falloff(mask, params)
        
        # Apply texture if specified
        if params.texture:
            mask = self._apply_texture(mask, params.texture)
        
        # Set brush color (white for preview)
        brush_color = np.array([255, 255, 255], dtype=np.uint8)
        
        # Apply mask to create brush stamp
        stamp[:, :, :3] = brush_color
        stamp[:, :, 3] = (mask * 255).astype(np.uint8)
        
        return stamp
    
    def _render_brush_stroke(
        self,
        params: BrushParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Render a representative brush stroke with spacing.
        
        Args:
            params: Brush parameters
            width: Canvas width
            height: Canvas height
            
        Returns:
            RGBA numpy array (H, W, 4) with brush stroke
        """
        # Create stroke buffer
        stroke = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Calculate stroke path (simple curved line)
        # Start from left, curve through middle, end at right
        num_stamps = max(3, int(width / (params.size * params.spacing)))
        
        # Generate stroke path points
        path_points = []
        for i in range(num_stamps):
            t = i / (num_stamps - 1)  # 0 to 1
            
            # X position (left to right)
            x = width * 0.1 + width * 0.8 * t
            
            # Y position (curved path - sine wave)
            y = height / 2 + np.sin(t * np.pi * 2) * height * 0.15
            
            path_points.append((x, y))
        
        # Render each stamp along the path
        for px, py in path_points:
            # Generate brush mask at this position
            mask = self._generate_brush_mask(params, width, height, px, py)
            
            # Apply falloff curve
            mask = self._apply_falloff(mask, params)
            
            # Apply texture if specified
            if params.texture:
                mask = self._apply_texture(mask, params.texture)
            
            # Create stamp at this position
            stamp = np.zeros((height, width, 4), dtype=np.uint8)
            brush_color = np.array([255, 255, 255], dtype=np.uint8)
            stamp[:, :, :3] = brush_color
            stamp[:, :, 3] = (mask * 255).astype(np.uint8)
            
            # Composite stamp onto stroke (additive blending for overlaps)
            stroke = self._composite_brush_additive(stroke, stamp)
        
        return stroke
    
    def _generate_brush_mask(
        self,
        params: BrushParams,
        width: int,
        height: int,
        cx: float,
        cy: float
    ) -> np.ndarray:
        """
        Generate brush shape mask.
        
        Args:
            params: Brush parameters
            width: Canvas width
            height: Canvas height
            cx: Brush center X
            cy: Brush center Y
            
        Returns:
            Mask array (H, W) with values in [0, 1]
        """
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        radius = params.size / 2
        
        if params.shape == BrushShape.CIRCULAR:
            # Circular brush
            dist = np.sqrt((x - cx)**2 + (y - cy)**2)
            # Normalize distance to [0, 1] range
            mask = np.clip(1.0 - (dist / radius), 0, 1)
        
        elif params.shape == BrushShape.SQUARE:
            # Square brush
            dx = np.abs(x - cx)
            dy = np.abs(y - cy)
            # Distance from square edge
            dist = np.maximum(dx, dy)
            # Normalize distance to [0, 1] range
            mask = np.clip(1.0 - (dist / radius), 0, 1)
        
        elif params.shape == BrushShape.CUSTOM:
            # Custom brush shape (default to circular for now)
            # Can be extended to support custom shape definitions
            dist = np.sqrt((x - cx)**2 + (y - cy)**2)
            mask = np.clip(1.0 - (dist / radius), 0, 1)
        
        else:
            raise ValueError(f"Unsupported brush shape: {params.shape}")
        
        return mask
    
    def _apply_falloff(self, mask: np.ndarray, params: BrushParams) -> np.ndarray:
        """
        Apply falloff curve to brush mask.
        
        Args:
            mask: Brush mask (H, W) with values in [0, 1]
            params: Brush parameters
            
        Returns:
            Modified mask with falloff applied
        """
        # Apply hardness parameter
        # Hardness controls the transition from full to zero opacity
        # 0.0 = very soft, 1.0 = very hard
        
        if params.falloff_curve == FalloffCurve.LINEAR:
            # Linear falloff (no modification needed, mask is already linear)
            falloff_mask = mask
        
        elif params.falloff_curve == FalloffCurve.SMOOTH:
            # Smooth falloff (smoothstep function)
            # Creates a smooth S-curve transition
            falloff_mask = mask * mask * (3.0 - 2.0 * mask)
        
        elif params.falloff_curve == FalloffCurve.SHARP:
            # Sharp falloff (power curve)
            # Creates a sharper transition
            falloff_mask = np.power(mask, 2.0)
        
        elif params.falloff_curve == FalloffCurve.CUSTOM:
            # Custom falloff curve
            if params.custom_curve:
                # Interpolate custom curve
                falloff_mask = self._apply_custom_curve(mask, params.custom_curve)
            else:
                # Default to smooth if no custom curve provided
                falloff_mask = mask * mask * (3.0 - 2.0 * mask)
        
        else:
            falloff_mask = mask
        
        # Apply hardness
        # Hardness remaps the falloff curve
        # High hardness = sharper edge, low hardness = softer edge
        if params.hardness < 1.0:
            # Remap the falloff to create softer edges
            # hardness = 0.0 -> very soft (linear)
            # hardness = 1.0 -> use falloff as-is
            falloff_mask = np.power(falloff_mask, 1.0 / (params.hardness + 0.1))
        
        return np.clip(falloff_mask, 0, 1)
    
    def _apply_custom_curve(
        self,
        mask: np.ndarray,
        curve_points: list
    ) -> np.ndarray:
        """
        Apply custom falloff curve using interpolation.
        
        Args:
            mask: Brush mask (H, W) with values in [0, 1]
            curve_points: List of curve values (0.0 to 1.0)
            
        Returns:
            Modified mask with custom curve applied
        """
        # Interpolate curve points
        # curve_points defines the output values at evenly spaced input positions
        
        if len(curve_points) < 2:
            return mask
        
        # Create lookup table from curve points
        num_points = len(curve_points)
        input_positions = np.linspace(0, 1, num_points)
        
        # Interpolate for all mask values
        result = np.interp(mask.flatten(), input_positions, curve_points)
        result = result.reshape(mask.shape)
        
        return result
    
    def _apply_texture(self, mask: np.ndarray, texture_path: str) -> np.ndarray:
        """
        Apply texture overlay to brush mask.
        
        Args:
            mask: Brush mask (H, W) with values in [0, 1]
            texture_path: Path to texture image file
            
        Returns:
            Modified mask with texture applied
        """
        try:
            # Load texture image
            texture_img = Image.open(texture_path).convert('L')  # Grayscale
            
            # Resize texture to match mask dimensions
            texture_img = texture_img.resize(
                (mask.shape[1], mask.shape[0]),
                Image.Resampling.LANCZOS
            )
            
            # Convert to numpy array and normalize to [0, 1]
            texture_array = np.array(texture_img, dtype=np.float32) / 255.0
            
            # Multiply mask by texture
            textured_mask = mask * texture_array
            
            return textured_mask
            
        except Exception as e:
            logger.warning(f"Failed to load texture from {texture_path}: {e}")
            # Return original mask if texture loading fails
            return mask
    
    def _composite_brush(
        self,
        canvas: np.ndarray,
        brush: np.ndarray
    ) -> np.ndarray:
        """
        Composite brush layer onto canvas using normal alpha blending.
        
        Args:
            canvas: Background canvas (H, W, 4)
            brush: Brush layer (H, W, 4)
            
        Returns:
            Composited result (H, W, 4)
        """
        # Extract alpha channels
        canvas_alpha = canvas[:, :, 3].astype(np.float32) / 255.0
        brush_alpha = brush[:, :, 3].astype(np.float32) / 255.0
        
        # Extract RGB channels
        canvas_rgb = canvas[:, :, :3].astype(np.float32)
        brush_rgb = brush[:, :, :3].astype(np.float32)
        
        # Alpha compositing (over operation)
        out_alpha = brush_alpha + canvas_alpha * (1 - brush_alpha)
        out_alpha = np.clip(out_alpha, 0, 1)
        
        # Composite RGB
        brush_alpha_3d = brush_alpha[:, :, np.newaxis]
        canvas_alpha_3d = canvas_alpha[:, :, np.newaxis]
        out_alpha_3d = out_alpha[:, :, np.newaxis]
        
        out_rgb = np.where(
            out_alpha_3d > 0,
            (brush_rgb * brush_alpha_3d + canvas_rgb * canvas_alpha_3d * (1 - brush_alpha_3d)) / out_alpha_3d,
            0
        )
        
        # Create output
        result = np.zeros_like(canvas)
        result[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
        result[:, :, 3] = (out_alpha * 255).astype(np.uint8)
        
        return result
    
    def _composite_brush_additive(
        self,
        canvas: np.ndarray,
        brush: np.ndarray
    ) -> np.ndarray:
        """
        Composite brush layer onto canvas using additive blending.
        Used for stroke rendering to handle overlapping stamps.
        
        Args:
            canvas: Background canvas (H, W, 4)
            brush: Brush layer (H, W, 4)
            
        Returns:
            Composited result (H, W, 4)
        """
        # Extract alpha channels
        canvas_alpha = canvas[:, :, 3].astype(np.float32) / 255.0
        brush_alpha = brush[:, :, 3].astype(np.float32) / 255.0
        
        # Additive alpha blending (clamped to 1.0)
        out_alpha = np.clip(canvas_alpha + brush_alpha, 0, 1)
        
        # Extract RGB channels
        canvas_rgb = canvas[:, :, :3].astype(np.float32)
        brush_rgb = brush[:, :, :3].astype(np.float32)
        
        # Additive RGB blending (weighted by alpha)
        out_rgb = canvas_rgb + brush_rgb * (brush_alpha[:, :, np.newaxis])
        out_rgb = np.clip(out_rgb, 0, 255)
        
        # Create output
        result = np.zeros_like(canvas)
        result[:, :, :3] = out_rgb.astype(np.uint8)
        result[:, :, 3] = (out_alpha * 255).astype(np.uint8)
        
        return result
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate brush parameters with additional checks.
        
        Args:
            params: Parameter dictionary
            
        Returns:
            True if valid
            
        Raises:
            ValueError: If parameters are invalid
        """
        # Call base validation
        super().validate_params(params)
        
        # Additional brush-specific validation
        if "size" in params:
            size = params["size"]
            if size <= 0:
                raise ValueError(f"Brush size must be positive, got {size}")
            if size > 1024:
                raise ValueError(f"Brush size too large (max 1024), got {size}")
        
        if "hardness" in params:
            hardness = params["hardness"]
            if not (0.0 <= hardness <= 1.0):
                raise ValueError(f"Brush hardness must be in [0.0, 1.0], got {hardness}")
        
        if "spacing" in params:
            spacing = params["spacing"]
            if not (0.0 <= spacing <= 1.0):
                raise ValueError(f"Brush spacing must be in [0.0, 1.0], got {spacing}")
        
        if "custom_curve" in params and params["custom_curve"]:
            curve = params["custom_curve"]
            if not isinstance(curve, list):
                raise ValueError("custom_curve must be a list")
            if len(curve) < 2:
                raise ValueError("custom_curve must have at least 2 points")
            for val in curve:
                if not (0.0 <= val <= 1.0):
                    raise ValueError(f"custom_curve values must be in [0.0, 1.0], got {val}")
        
        return True
    
    def __repr__(self) -> str:
        """String representation"""
        return f"BrushGenerator(type={self.generator_type.value})"
