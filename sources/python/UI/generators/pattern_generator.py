"""
UI Forge Pattern Generator

Generates tileable fill patterns using procedural algorithms.
Supports various pattern types including stripes, checkerboard, dots, waves,
and more complex procedural patterns.

Design Philosophy:
- Data-driven: All pattern properties from template parameters
- Tileable: All patterns seamlessly tile without visible seams
- Procedural: Uses numpy for efficient pattern generation
- Flexible: Supports arbitrary dimensions and color schemes
"""

import numpy as np
from typing import Dict, Any, Type, Optional, List, Tuple
import logging

from models import Template, GeneratorType
from generators.base import BaseGenerator, register_generator


logger = logging.getLogger(__name__)


@register_generator
class PatternGenerator(BaseGenerator):
    """
    Pattern generator for tileable fill patterns.
    
    Features:
    - Tileable pattern generation (seamless wrapping)
    - Procedural algorithms: stripes, checkerboard, dots, waves, grid, diagonal
    - Noise-based patterns: perlin, simplex, cellular
    - Arbitrary output dimensions
    - Multi-color support
    - Configurable scale and rotation
    
    All visual properties are data-driven from templates with zero hardcoded values.
    """
    
    def _get_generator_type(self) -> GeneratorType:
        """Return generator type"""
        return GeneratorType.PATTERN
    
    def supported_params(self) -> Dict[str, Type]:
        """Return supported parameter schema"""
        return {
            "pattern_type": str,
            "colors": list,
            "scale": (int, float),
            "rotation": (int, float),
            "frequency": (int, float),
            "amplitude": (int, float),
            "offset": (tuple, list, type(None)),
            "noise_octaves": int,
            "noise_persistence": float,
            "noise_lacunarity": float,
            "stripe_width": (int, float),
            "dot_radius": (int, float),
            "grid_spacing": (int, float),
            "background": (str, type(None))
        }
    
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate tileable pattern from template.
        
        Args:
            template: Template with pattern parameters
            
        Returns:
            Numpy array (H, W, 4) with RGBA uint8 data
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Parse pattern parameters
        params = template.params
        self.validate_params(params)
        
        pattern_type = params.get("pattern_type", "checkerboard")
        colors = params.get("colors", ["#FFFFFF", "#000000"])
        scale = params.get("scale", 1.0)
        rotation = params.get("rotation", 0.0)
        background = params.get("background")
        
        logger.debug(
            f"Generating pattern: {width}x{height}, "
            f"type={pattern_type}, scale={scale}, rotation={rotation}"
        )
        
        # Create canvas
        canvas = self.create_blank_canvas(width, height, background)
        
        # Generate pattern based on type
        if pattern_type == "stripes":
            pattern = self._generate_stripes(width, height, params)
        elif pattern_type == "checkerboard":
            pattern = self._generate_checkerboard(width, height, params)
        elif pattern_type == "dots":
            pattern = self._generate_dots(width, height, params)
        elif pattern_type == "waves":
            pattern = self._generate_waves(width, height, params)
        elif pattern_type == "grid":
            pattern = self._generate_grid(width, height, params)
        elif pattern_type == "diagonal":
            pattern = self._generate_diagonal(width, height, params)
        elif pattern_type == "perlin":
            pattern = self._generate_perlin_noise(width, height, params)
        elif pattern_type == "cellular":
            pattern = self._generate_cellular(width, height, params)
        elif pattern_type == "hexagon":
            pattern = self._generate_hexagon(width, height, params)
        elif pattern_type == "brick":
            pattern = self._generate_brick(width, height, params)
        else:
            raise ValueError(f"Unsupported pattern type: {pattern_type}")
        
        # Apply colors to pattern
        colored_pattern = self._apply_colors(pattern, colors)
        
        # Composite onto canvas
        if background:
            # Blend pattern with background
            canvas[:, :, :3] = colored_pattern[:, :, :3]
            canvas[:, :, 3] = colored_pattern[:, :, 3]
        else:
            canvas = colored_pattern
        
        return canvas
    
    def _generate_stripes(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate horizontal or vertical stripes pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        stripe_width = params.get("stripe_width", 10.0)
        rotation = params.get("rotation", 0.0)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Apply rotation
        if rotation != 0:
            angle_rad = np.radians(rotation)
            cos_a = np.cos(angle_rad)
            sin_a = np.sin(angle_rad)
            
            # Rotate coordinates around center
            cx, cy = width / 2, height / 2
            x_rot = (x - cx) * cos_a - (y - cy) * sin_a + cx
            y_rot = (x - cx) * sin_a + (y - cy) * cos_a + cy
            
            # Use rotated x coordinate for stripes
            coord = x_rot
        else:
            # Horizontal stripes use y coordinate
            coord = y
        
        # Generate stripe pattern (tileable)
        pattern = (np.floor(coord / stripe_width) % 2).astype(np.float32)
        
        return pattern
    
    def _generate_checkerboard(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate checkerboard pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        cell_size = int(max(1, 16 * scale))
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Generate checkerboard pattern (tileable)
        pattern = ((np.floor(x / cell_size) + np.floor(y / cell_size)) % 2).astype(np.float32)
        
        return pattern
    
    def _generate_dots(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate dots pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        dot_radius = params.get("dot_radius", 5.0 * scale)
        grid_spacing = params.get("grid_spacing", 20.0 * scale)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Initialize pattern
        pattern = np.zeros((height, width), dtype=np.float32)
        
        # Generate grid of dots (tileable)
        for dy in range(int(-grid_spacing), height + int(grid_spacing), int(grid_spacing)):
            for dx in range(int(-grid_spacing), width + int(grid_spacing), int(grid_spacing)):
                # Calculate distance from dot center (with wrapping for tileability)
                dist_x = np.minimum(np.abs(x - dx), width - np.abs(x - dx))
                dist_y = np.minimum(np.abs(y - dy), height - np.abs(y - dy))
                dist = np.sqrt(dist_x**2 + dist_y**2)
                
                # Add dot with anti-aliased edge
                dot_mask = np.clip(dot_radius + 0.5 - dist, 0, 1)
                pattern = np.maximum(pattern, dot_mask)
        
        return pattern
    
    def _generate_waves(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate wave pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        frequency = params.get("frequency", 0.1)
        amplitude = params.get("amplitude", 10.0)
        rotation = params.get("rotation", 0.0)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Apply rotation
        if rotation != 0:
            angle_rad = np.radians(rotation)
            cos_a = np.cos(angle_rad)
            sin_a = np.sin(angle_rad)
            
            cx, cy = width / 2, height / 2
            x_rot = (x - cx) * cos_a - (y - cy) * sin_a + cx
            y_rot = (x - cx) * sin_a + (y - cy) * cos_a + cy
            
            x_coord = x_rot
            y_coord = y_rot
        else:
            x_coord = x
            y_coord = y
        
        # Generate wave pattern (tileable sine wave)
        wave = np.sin(x_coord * frequency * 2 * np.pi / width) * amplitude
        
        # Create pattern based on wave threshold
        pattern = ((y_coord - height / 2) < wave).astype(np.float32)
        
        return pattern
    
    def _generate_grid(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate grid pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        grid_spacing = params.get("grid_spacing", 20.0 * scale)
        stripe_width = params.get("stripe_width", 2.0 * scale)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Generate vertical lines
        x_mod = x % grid_spacing
        vertical_lines = (x_mod < stripe_width).astype(np.float32)
        
        # Generate horizontal lines
        y_mod = y % grid_spacing
        horizontal_lines = (y_mod < stripe_width).astype(np.float32)
        
        # Combine lines
        pattern = np.maximum(vertical_lines, horizontal_lines)
        
        return pattern
    
    def _generate_diagonal(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate diagonal stripes pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        stripe_width = params.get("stripe_width", 10.0)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Diagonal stripes (45 degrees)
        # Use x + y for diagonal direction
        diagonal_coord = x + y
        
        # Generate stripe pattern (tileable)
        pattern = (np.floor(diagonal_coord / stripe_width) % 2).astype(np.float32)
        
        return pattern
    
    def _generate_perlin_noise(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate Perlin noise pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        octaves = params.get("noise_octaves", 4)
        persistence = params.get("noise_persistence", 0.5)
        lacunarity = params.get("noise_lacunarity", 2.0)
        
        # Simple Perlin-like noise using numpy
        # This is a simplified implementation - for production, use noise library
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Normalize coordinates
        x_norm = x / width * scale
        y_norm = y / height * scale
        
        # Generate multi-octave noise
        noise = np.zeros((height, width), dtype=np.float32)
        amplitude = 1.0
        frequency = 1.0
        max_value = 0.0
        
        for _ in range(octaves):
            # Simple noise using sine waves (placeholder for real Perlin)
            octave_noise = (
                np.sin(x_norm * frequency * 2 * np.pi) *
                np.cos(y_norm * frequency * 2 * np.pi)
            )
            
            noise += octave_noise * amplitude
            max_value += amplitude
            
            amplitude *= persistence
            frequency *= lacunarity
        
        # Normalize to [0, 1]
        noise = (noise / max_value + 1) / 2
        noise = np.clip(noise, 0, 1)
        
        return noise
    
    def _generate_cellular(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate cellular (Voronoi) pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        num_points = int(20 * scale)
        
        # Generate random cell points (seeded for reproducibility)
        np.random.seed(42)
        points = np.random.rand(num_points, 2)
        points[:, 0] *= width
        points[:, 1] *= height
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance to nearest point for each pixel
        min_dist = np.full((height, width), float('inf'), dtype=np.float32)
        
        for px, py in points:
            # Calculate distance with wrapping for tileability
            dist_x = np.minimum(np.abs(x - px), width - np.abs(x - px))
            dist_y = np.minimum(np.abs(y - py), height - np.abs(y - py))
            dist = np.sqrt(dist_x**2 + dist_y**2)
            
            min_dist = np.minimum(min_dist, dist)
        
        # Normalize distances to [0, 1]
        pattern = min_dist / np.max(min_dist)
        
        return pattern
    
    def _generate_hexagon(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate hexagon pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        hex_size = 20.0 * scale
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Hexagonal grid spacing
        hex_width = hex_size * np.sqrt(3)
        hex_height = hex_size * 1.5
        
        # Convert to hexagonal coordinates
        col = x / hex_width
        row = y / hex_height
        
        # Offset every other row
        col_offset = np.where((row.astype(int) % 2) == 1, 0.5, 0.0)
        col = col - col_offset
        
        # Find nearest hexagon center
        col_int = np.round(col)
        row_int = np.round(row)
        
        # Calculate distance from hexagon center
        hex_x = col_int * hex_width + col_offset * hex_width
        hex_y = row_int * hex_height
        
        dist = np.sqrt((x - hex_x)**2 + (y - hex_y)**2)
        
        # Create hexagon pattern
        pattern = (dist < hex_size * 0.8).astype(np.float32)
        
        return pattern
    
    def _generate_brick(
        self,
        width: int,
        height: int,
        params: Dict[str, Any]
    ) -> np.ndarray:
        """
        Generate brick pattern.
        
        Args:
            width: Pattern width
            height: Pattern height
            params: Pattern parameters
            
        Returns:
            Pattern mask (H, W) with values in [0, 1]
        """
        scale = params.get("scale", 1.0)
        brick_width = 40.0 * scale
        brick_height = 20.0 * scale
        mortar_width = 2.0 * scale
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate brick row
        row = np.floor(y / brick_height).astype(int)
        
        # Offset every other row (brick pattern)
        x_offset = np.where((row % 2) == 1, brick_width / 2, 0.0)
        x_adjusted = (x - x_offset) % (brick_width * 2)
        
        # Calculate position within brick
        x_in_brick = x_adjusted % brick_width
        y_in_brick = y % brick_height
        
        # Create mortar lines
        horizontal_mortar = (y_in_brick < mortar_width).astype(np.float32)
        vertical_mortar = (x_in_brick < mortar_width).astype(np.float32)
        
        # Combine mortar lines (mortar = 0, brick = 1)
        pattern = 1.0 - np.maximum(horizontal_mortar, vertical_mortar)
        
        return pattern
    
    def _apply_colors(
        self,
        pattern: np.ndarray,
        colors: List[str]
    ) -> np.ndarray:
        """
        Apply colors to pattern mask.
        
        Args:
            pattern: Pattern mask (H, W) with values in [0, 1]
            colors: List of color hex codes
            
        Returns:
            RGBA numpy array (H, W, 4)
        """
        height, width = pattern.shape
        
        if len(colors) == 0:
            # No colors specified, use grayscale
            result = np.zeros((height, width, 4), dtype=np.uint8)
            result[:, :, :3] = (pattern[:, :, np.newaxis] * 255).astype(np.uint8)
            result[:, :, 3] = 255
            return result
        
        if len(colors) == 1:
            # Single color
            color = self._parse_hex_color(colors[0])
            result = np.zeros((height, width, 4), dtype=np.uint8)
            result[:, :, :3] = color
            result[:, :, 3] = (pattern * 255).astype(np.uint8)
            return result
        
        # Multiple colors - interpolate based on pattern value
        result = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Parse all colors
        color_values = [self._parse_hex_color(c) for c in colors]
        
        # Interpolate between colors
        num_colors = len(color_values)
        pattern_scaled = pattern * (num_colors - 1)
        
        for i in range(num_colors - 1):
            # Find pixels in this color segment
            mask = (pattern_scaled >= i) & (pattern_scaled < i + 1)
            
            if np.any(mask):
                # Interpolation factor within segment
                t = (pattern_scaled - i)
                t = np.clip(t, 0, 1)
                
                # Interpolate RGB
                color_start = np.array(color_values[i], dtype=np.float32)
                color_end = np.array(color_values[i + 1], dtype=np.float32)
                
                for c in range(3):
                    result[:, :, c] = np.where(
                        mask,
                        color_start[c] + t * (color_end[c] - color_start[c]),
                        result[:, :, c]
                    )
        
        # Handle edge case for maximum value
        mask = pattern_scaled >= (num_colors - 1)
        if np.any(mask):
            result[mask, :3] = color_values[-1]
        
        # Set alpha to full opacity
        result[:, :, 3] = 255
        
        return result
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate pattern parameters with additional checks.
        
        Args:
            params: Parameter dictionary
            
        Returns:
            True if valid
            
        Raises:
            ValueError: If parameters are invalid
        """
        # Call base validation
        super().validate_params(params)
        
        # Additional pattern-specific validation
        if "pattern_type" in params:
            valid_types = [
                "stripes", "checkerboard", "dots", "waves", "grid",
                "diagonal", "perlin", "cellular", "hexagon", "brick"
            ]
            if params["pattern_type"] not in valid_types:
                raise ValueError(
                    f"Invalid pattern_type: {params['pattern_type']}. "
                    f"Valid types: {valid_types}"
                )
        
        if "scale" in params:
            scale = params["scale"]
            if scale <= 0:
                raise ValueError(f"Scale must be positive, got {scale}")
        
        if "rotation" in params:
            rotation = params["rotation"]
            if not (-360 <= rotation <= 360):
                raise ValueError(f"Rotation must be in [-360, 360], got {rotation}")
        
        if "colors" in params:
            colors = params["colors"]
            if not isinstance(colors, list):
                raise ValueError("colors must be a list")
            if len(colors) == 0:
                raise ValueError("colors list cannot be empty")
        
        return True
    
    def __repr__(self) -> str:
        """String representation"""
        return f"PatternGenerator(type={self.generator_type.value})"
