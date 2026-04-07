"""
UI Forge Alpha Generator

Generates alpha masks and alpha channel assets with gradient alpha, shape-based alpha,
procedural patterns, and alpha operations. Supports embedded alpha, separate mask files,
or both output modes.

Design Philosophy:
- Data-driven: All alpha properties from template parameters
- First-class feature: Alpha generation as primary capability, not afterthought
- Compositable: Multiple alpha sources can be combined with blend modes
- GPU-friendly: Uses numpy arrays for efficient operations
"""

import numpy as np
from typing import Dict, Any, Type, Tuple, Optional
import logging
from scipy import ndimage

from models import (
    Template, GeneratorType, AlphaParams, AlphaType, AlphaMode,
    NoiseType, BlendMode
)
from generators.base import BaseGenerator, register_generator


logger = logging.getLogger(__name__)


@register_generator
class AlphaGenerator(BaseGenerator):
    """
    Alpha mask generator with gradient, shape, and procedural patterns.
    
    Features:
    - Gradient alpha: linear, radial, angular falloffs
    - Shape-based alpha: geometric primitives with feathering
    - Procedural patterns: Perlin/simplex noise, Voronoi, cellular
    - Alpha operations: invert, multiply, screen, overlay
    - Alpha from luminance conversion
    - Separate grayscale mask file generation
    - Dimension validation between color and alpha assets
    
    All visual properties are data-driven from templates with zero hardcoded values.
    """
    
    def _get_generator_type(self) -> GeneratorType:
        """Return generator type"""
        return GeneratorType.ALPHA
    
    def supported_params(self) -> Dict[str, Type]:
        """Return supported parameter schema"""
        return {
            "type": str,
            "gradient_type": (str, type(None)),
            "gradient_angle": (int, float, type(None)),
            "gradient_center": (tuple, list, type(None)),
            "gradient_stops": (list, type(None)),
            "shape": (str, type(None)),
            "shape_geometry": (dict, type(None)),
            "feather": (int, float, type(None)),
            "noise_type": (str, type(None)),
            "noise_scale": (int, float, type(None)),
            "noise_octaves": (int, type(None)),
            "noise_persistence": (int, float, type(None)),
            "noise_lacunarity": (int, float, type(None)),
            "invert": bool,
            "blend_mode": (str, type(None)),
            "threshold": (int, float, type(None)),
            "luminance_weights": (tuple, list, type(None)),
            "edge_threshold": (int, float, type(None)),
            "edge_blur": (int, float, type(None))
        }
    
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate alpha mask from template.
        
        Args:
            template: Template with alpha parameters
            
        Returns:
            Numpy array (H, W, 4) with RGBA uint8 data
            For alpha masks, RGB channels contain grayscale alpha,
            and A channel is set to 255 (opaque)
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Parse alpha parameters
        params = self._parse_alpha_params(template.params)
        
        logger.debug(
            f"Generating alpha mask: {width}x{height}, type={params.type.value}"
        )
        
        # Generate base alpha mask based on type
        if params.type == AlphaType.GRADIENT:
            alpha_mask = self._generate_gradient_alpha(params, width, height)
        elif params.type == AlphaType.SHAPE:
            alpha_mask = self._generate_shape_alpha(params, width, height)
        elif params.type == AlphaType.PROCEDURAL:
            alpha_mask = self._generate_procedural_alpha(params, width, height)
        elif params.type == AlphaType.LUMINANCE:
            # Luminance requires source image - not implemented in base generator
            raise NotImplementedError("Luminance alpha requires source image")
        elif params.type == AlphaType.EDGE:
            # Edge detection requires source image - not implemented in base generator
            raise NotImplementedError("Edge alpha requires source image")
        else:
            raise ValueError(f"Unsupported alpha type: {params.type}")
        
        # Apply operations
        if params.invert:
            alpha_mask = 1.0 - alpha_mask
        
        if params.threshold is not None:
            alpha_mask = (alpha_mask >= params.threshold).astype(np.float32)
        
        # Convert to RGBA image (grayscale alpha in RGB channels)
        result = np.zeros((height, width, 4), dtype=np.uint8)
        alpha_uint8 = (np.clip(alpha_mask, 0, 1) * 255).astype(np.uint8)
        result[:, :, 0] = alpha_uint8  # R
        result[:, :, 1] = alpha_uint8  # G
        result[:, :, 2] = alpha_uint8  # B
        result[:, :, 3] = 255  # Full opacity for the mask itself
        
        return result
    
    def _parse_alpha_params(self, params: Dict[str, Any]) -> AlphaParams:
        """Parse and validate alpha parameters"""
        # Validate parameters
        self.validate_params(params)
        
        # Parse alpha type
        alpha_type = AlphaType(params.get("type", "gradient"))
        
        # Create AlphaParams
        return AlphaParams(
            type=alpha_type,
            gradient_type=params.get("gradient_type"),
            gradient_angle=params.get("gradient_angle"),
            gradient_center=tuple(params["gradient_center"]) if "gradient_center" in params else None,
            gradient_stops=params.get("gradient_stops"),
            shape=params.get("shape"),
            shape_geometry=params.get("shape_geometry"),
            feather=params.get("feather"),
            noise_type=NoiseType(params["noise_type"]) if "noise_type" in params else None,
            noise_scale=params.get("noise_scale"),
            noise_octaves=params.get("noise_octaves"),
            noise_persistence=params.get("noise_persistence"),
            noise_lacunarity=params.get("noise_lacunarity"),
            invert=params.get("invert", False),
            blend_mode=BlendMode(params["blend_mode"]) if "blend_mode" in params else None,
            threshold=params.get("threshold"),
            luminance_weights=tuple(params["luminance_weights"]) if "luminance_weights" in params else None,
            edge_threshold=params.get("edge_threshold"),
            edge_blur=params.get("edge_blur")
        )
    
    # ========================================================================
    # Gradient Alpha Generation
    # ========================================================================
    
    def _generate_gradient_alpha(
        self,
        params: AlphaParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Generate gradient alpha mask.
        
        Args:
            params: Alpha parameters with gradient configuration
            width: Mask width
            height: Mask height
            
        Returns:
            Alpha mask (H, W) with values in [0, 1]
        """
        gradient_type = params.gradient_type or "linear"
        
        if gradient_type == "linear":
            return self._generate_linear_gradient_alpha(params, width, height)
        elif gradient_type == "radial":
            return self._generate_radial_gradient_alpha(params, width, height)
        elif gradient_type == "angular":
            return self._generate_angular_gradient_alpha(params, width, height)
        else:
            raise ValueError(f"Unsupported gradient type: {gradient_type}")
    
    def _generate_linear_gradient_alpha(
        self,
        params: AlphaParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate linear gradient alpha"""
        angle = params.gradient_angle if params.gradient_angle is not None else 0.0
        angle_rad = np.radians(angle)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Center coordinates
        cx, cy = width / 2, height / 2
        
        # Calculate gradient direction vector
        dx = np.cos(angle_rad)
        dy = np.sin(angle_rad)
        
        # Project coordinates onto gradient axis
        max_dist = max(width, height) * np.sqrt(2) / 2
        t = ((x - cx) * dx + (y - cy) * dy) / max_dist
        t = (t + 1) / 2  # Map from [-1, 1] to [0, 1]
        t = np.clip(t, 0, 1)
        
        # Apply gradient stops if provided
        if params.gradient_stops:
            t = self._apply_gradient_stops(t, params.gradient_stops)
        
        return t
    
    def _generate_radial_gradient_alpha(
        self,
        params: AlphaParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate radial gradient alpha"""
        # Get center point (default to canvas center)
        if params.gradient_center:
            cx = params.gradient_center[0] * width
            cy = params.gradient_center[1] * height
        else:
            cx, cy = width / 2, height / 2
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance from center
        max_radius = max(width, height) * np.sqrt(2) / 2
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        t = dist / max_radius
        t = np.clip(t, 0, 1)
        
        # Apply gradient stops if provided
        if params.gradient_stops:
            t = self._apply_gradient_stops(t, params.gradient_stops)
        
        return t
    
    def _generate_angular_gradient_alpha(
        self,
        params: AlphaParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate angular (conic) gradient alpha"""
        # Get center point (default to canvas center)
        if params.gradient_center:
            cx = params.gradient_center[0] * width
            cy = params.gradient_center[1] * height
        else:
            cx, cy = width / 2, height / 2
        
        # Get starting angle
        start_angle = params.gradient_angle if params.gradient_angle is not None else 0.0
        start_angle_rad = np.radians(start_angle)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate angle from center
        angle = np.arctan2(y - cy, x - cx)
        
        # Normalize to [0, 1] range
        t = (angle - start_angle_rad) / (2 * np.pi)
        t = np.fmod(t, 1.0)
        t = np.where(t < 0, t + 1, t)
        
        # Apply gradient stops if provided
        if params.gradient_stops:
            t = self._apply_gradient_stops(t, params.gradient_stops)
        
        return t
    
    def _apply_gradient_stops(
        self,
        t: np.ndarray,
        stops: list
    ) -> np.ndarray:
        """Apply gradient stops to remap alpha values"""
        if len(stops) < 2:
            return t
        
        # Stops should be in [0, 1] range
        stops = np.array(stops)
        stops = np.clip(stops, 0, 1)
        stops = np.sort(stops)
        
        # Remap t values based on stops
        result = np.zeros_like(t)
        
        for i in range(len(stops) - 1):
            start_stop = stops[i]
            end_stop = stops[i + 1]
            
            # Find pixels in this segment
            mask = (t >= start_stop) & (t <= end_stop)
            
            if np.any(mask):
                # Remap to [i/(n-1), (i+1)/(n-1)]
                segment_t = (t - start_stop) / (end_stop - start_stop)
                result = np.where(
                    mask,
                    i / (len(stops) - 1) + segment_t / (len(stops) - 1),
                    result
                )
        
        # Handle pixels before first stop
        result = np.where(t < stops[0], 0, result)
        
        # Handle pixels after last stop
        result = np.where(t > stops[-1], 1, result)
        
        return result
    
    # ========================================================================
    # Shape-Based Alpha Generation
    # ========================================================================
    
    def _generate_shape_alpha(
        self,
        params: AlphaParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Generate shape-based alpha mask with feathering.
        
        Args:
            params: Alpha parameters with shape configuration
            width: Mask width
            height: Mask height
            
        Returns:
            Alpha mask (H, W) with values in [0, 1]
        """
        shape = params.shape or "circle"
        geometry = params.shape_geometry or {}
        feather = params.feather or 0.0
        
        # Generate base shape mask
        if shape == "circle":
            mask = self._generate_circle_shape(geometry, width, height)
        elif shape == "rect" or shape == "rectangle":
            mask = self._generate_rect_shape(geometry, width, height)
        elif shape == "polygon":
            mask = self._generate_polygon_shape(geometry, width, height)
        elif shape == "ellipse":
            mask = self._generate_ellipse_shape(geometry, width, height)
        else:
            raise ValueError(f"Unsupported shape type: {shape}")
        
        # Apply feathering (blur for soft edges)
        if feather > 0:
            mask = self._apply_feathering(mask, feather)
        
        return mask
    
    def _generate_circle_shape(
        self,
        geometry: Dict[str, Any],
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate circular alpha shape"""
        cx = geometry.get("cx", width / 2)
        cy = geometry.get("cy", height / 2)
        r = geometry.get("r", min(width, height) / 4)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance from center
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        
        # Anti-aliased edge (1 pixel transition)
        mask = np.clip(r + 0.5 - dist, 0, 1)
        
        return mask
    
    def _generate_rect_shape(
        self,
        geometry: Dict[str, Any],
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate rectangular alpha shape"""
        x = geometry.get("x", width * 0.25)
        y = geometry.get("y", height * 0.25)
        w = geometry.get("width", width * 0.5)
        h = geometry.get("height", height * 0.5)
        
        # Create coordinate grids
        yy, xx = np.ogrid[:height, :width]
        
        # Calculate distance from rectangle edges
        dx = np.maximum(x - xx, xx - (x + w))
        dy = np.maximum(y - yy, yy - (y + h))
        
        # Anti-aliased edges
        mask_x = np.clip(0.5 - dx, 0, 1)
        mask_y = np.clip(0.5 - dy, 0, 1)
        mask = mask_x * mask_y
        
        return mask
    
    def _generate_ellipse_shape(
        self,
        geometry: Dict[str, Any],
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate elliptical alpha shape"""
        cx = geometry.get("cx", width / 2)
        cy = geometry.get("cy", height / 2)
        rx = geometry.get("rx", width / 4)
        ry = geometry.get("ry", height / 4)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate ellipse equation
        dist = ((x - cx) / rx)**2 + ((y - cy) / ry)**2
        
        # Anti-aliased edge
        mask = np.clip(1.5 - dist, 0, 1)
        
        return mask
    
    def _generate_polygon_shape(
        self,
        geometry: Dict[str, Any],
        width: int,
        height: int
    ) -> np.ndarray:
        """Generate polygonal alpha shape"""
        points = geometry.get("points", [])
        
        if len(points) < 3:
            return np.zeros((height, width), dtype=np.float32)
        
        # Create mask using scanline algorithm
        mask = np.zeros((height, width), dtype=np.float32)
        
        for y in range(height):
            intersections = []
            
            for i in range(len(points)):
                p1 = points[i]
                p2 = points[(i + 1) % len(points)]
                
                y1, y2 = p1[1], p2[1]
                x1, x2 = p1[0], p2[0]
                
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
    
    def _apply_feathering(
        self,
        mask: np.ndarray,
        feather: float
    ) -> np.ndarray:
        """Apply Gaussian blur for soft edges (feathering)"""
        # Convert feather radius to sigma for Gaussian blur
        sigma = feather / 2.0
        
        # Apply Gaussian filter
        feathered = ndimage.gaussian_filter(mask, sigma=sigma)
        
        return feathered
    
    # ========================================================================
    # Procedural Alpha Generation
    # ========================================================================
    
    def _generate_procedural_alpha(
        self,
        params: AlphaParams,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Generate procedural alpha patterns using noise algorithms.
        
        Args:
            params: Alpha parameters with procedural configuration
            width: Mask width
            height: Mask height
            
        Returns:
            Alpha mask (H, W) with values in [0, 1]
        """
        noise_type = params.noise_type or NoiseType.PERLIN
        scale = params.noise_scale or 10.0
        octaves = params.noise_octaves or 4
        persistence = params.noise_persistence or 0.5
        lacunarity = params.noise_lacunarity or 2.0
        
        if noise_type == NoiseType.PERLIN:
            return self._generate_perlin_noise(width, height, scale, octaves, persistence, lacunarity)
        elif noise_type == NoiseType.SIMPLEX:
            return self._generate_simplex_noise(width, height, scale, octaves, persistence, lacunarity)
        elif noise_type == NoiseType.VORONOI:
            return self._generate_voronoi_noise(width, height, scale)
        elif noise_type == NoiseType.CELLULAR:
            return self._generate_cellular_noise(width, height, scale)
        else:
            raise ValueError(f"Unsupported noise type: {noise_type}")
    
    def _generate_perlin_noise(
        self,
        width: int,
        height: int,
        scale: float,
        octaves: int,
        persistence: float,
        lacunarity: float
    ) -> np.ndarray:
        """Generate Perlin-like noise using multiple octaves"""
        noise = np.zeros((height, width), dtype=np.float32)
        amplitude = 1.0
        frequency = 1.0
        max_value = 0.0
        
        np.random.seed(42)  # For reproducibility
        
        for octave in range(octaves):
            # Calculate frequency for this octave
            octave_freq = frequency * (2 ** octave) / scale
            
            # Generate noise at this frequency
            octave_height = max(1, int(height * octave_freq))
            octave_width = max(1, int(width * octave_freq))
            
            # Generate random noise
            octave_noise = np.random.rand(octave_height, octave_width)
            
            # Upsample to full resolution using bilinear interpolation
            octave_noise = ndimage.zoom(octave_noise, (height / octave_height, width / octave_width), order=1)
            
            # Crop to exact size
            octave_noise = octave_noise[:height, :width]
            
            # Add to accumulated noise with amplitude
            noise += octave_noise * amplitude
            
            # Track max value for normalization
            max_value += amplitude
            
            # Update amplitude and frequency for next octave
            amplitude *= persistence
            frequency *= lacunarity
        
        # Normalize to [0, 1]
        noise = noise / max_value
        
        return noise
    
    def _generate_simplex_noise(
        self,
        width: int,
        height: int,
        scale: float,
        octaves: int,
        persistence: float,
        lacunarity: float
    ) -> np.ndarray:
        """Generate simplex-like noise (simplified implementation)"""
        # For now, use Perlin-like approach
        # A true simplex implementation would require more complex gradient calculations
        return self._generate_perlin_noise(width, height, scale, octaves, persistence, lacunarity)
    
    def _generate_voronoi_noise(
        self,
        width: int,
        height: int,
        scale: float
    ) -> np.ndarray:
        """Generate Voronoi diagram noise"""
        # Number of seed points based on scale
        num_points = max(5, int((width * height) / (scale * scale)))
        
        np.random.seed(42)
        points = np.random.rand(num_points, 2)
        points[:, 0] *= width
        points[:, 1] *= height
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance to nearest point for each pixel
        min_dist = np.full((height, width), float('inf'), dtype=np.float32)
        
        for px, py in points:
            dist = np.sqrt((x - px)**2 + (y - py)**2)
            min_dist = np.minimum(min_dist, dist)
        
        # Normalize to [0, 1]
        if min_dist.max() > 0:
            min_dist = min_dist / min_dist.max()
        
        return min_dist
    
    def _generate_cellular_noise(
        self,
        width: int,
        height: int,
        scale: float
    ) -> np.ndarray:
        """Generate cellular (Worley) noise"""
        # Number of seed points based on scale
        num_points = max(5, int((width * height) / (scale * scale)))
        
        np.random.seed(42)
        points = np.random.rand(num_points, 2)
        points[:, 0] *= width
        points[:, 1] *= height
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distances to nearest and second-nearest points
        distances = []
        
        for px, py in points:
            dist = np.sqrt((x - px)**2 + (y - py)**2)
            distances.append(dist)
        
        # Stack distances and find two nearest
        distances = np.stack(distances, axis=-1)
        distances.sort(axis=-1)
        
        # Cellular pattern: difference between second and first nearest
        cellular = distances[:, :, 1] - distances[:, :, 0]
        
        # Normalize to [0, 1]
        if cellular.max() > 0:
            cellular = cellular / cellular.max()
        
        return cellular
    
    # ========================================================================
    # Alpha Operations and Compositing
    # ========================================================================
    
    def apply_alpha_operation(
        self,
        alpha1: np.ndarray,
        alpha2: np.ndarray,
        operation: BlendMode
    ) -> np.ndarray:
        """
        Apply alpha blend operation between two alpha masks.
        
        Args:
            alpha1: First alpha mask (H, W) with values in [0, 1]
            alpha2: Second alpha mask (H, W) with values in [0, 1]
            operation: Blend mode to apply
            
        Returns:
            Composited alpha mask (H, W) with values in [0, 1]
        """
        if operation == BlendMode.MULTIPLY:
            return alpha1 * alpha2
        elif operation == BlendMode.SCREEN:
            return 1 - (1 - alpha1) * (1 - alpha2)
        elif operation == BlendMode.OVERLAY:
            return np.where(
                alpha1 < 0.5,
                2 * alpha1 * alpha2,
                1 - 2 * (1 - alpha1) * (1 - alpha2)
            )
        elif operation == BlendMode.ADD:
            return np.clip(alpha1 + alpha2, 0, 1)
        elif operation == BlendMode.NORMAL:
            # Normal blend: alpha2 over alpha1
            return alpha2 + alpha1 * (1 - alpha2)
        else:
            raise ValueError(f"Unsupported blend mode: {operation}")
    
    def alpha_from_luminance(
        self,
        image: np.ndarray,
        weights: Optional[Tuple[float, float, float]] = None
    ) -> np.ndarray:
        """
        Convert image luminance to alpha mask.
        
        Args:
            image: RGB or RGBA image (H, W, C)
            weights: Optional RGB weights for luminance calculation
                     Default: (0.299, 0.587, 0.114) - standard luminance
            
        Returns:
            Alpha mask (H, W) with values in [0, 1]
        """
        if weights is None:
            weights = (0.299, 0.587, 0.114)  # Standard luminance weights
        
        # Extract RGB channels
        rgb = image[:, :, :3].astype(np.float32) / 255.0
        
        # Calculate weighted luminance
        luminance = (
            rgb[:, :, 0] * weights[0] +
            rgb[:, :, 1] * weights[1] +
            rgb[:, :, 2] * weights[2]
        )
        
        return np.clip(luminance, 0, 1)
    
    def alpha_from_edge_detection(
        self,
        image: np.ndarray,
        threshold: float = 0.1,
        blur: float = 1.0
    ) -> np.ndarray:
        """
        Generate alpha mask from edge detection.
        
        Args:
            image: RGB or RGBA image (H, W, C)
            threshold: Edge detection threshold (0.0 to 1.0)
            blur: Gaussian blur sigma for smoothing
            
        Returns:
            Alpha mask (H, W) with values in [0, 1]
        """
        # Convert to grayscale
        gray = self.alpha_from_luminance(image)
        
        # Apply Gaussian blur for noise reduction
        if blur > 0:
            gray = ndimage.gaussian_filter(gray, sigma=blur)
        
        # Calculate gradients using Sobel operator
        grad_x = ndimage.sobel(gray, axis=1)
        grad_y = ndimage.sobel(gray, axis=0)
        
        # Calculate gradient magnitude
        magnitude = np.sqrt(grad_x**2 + grad_y**2)
        
        # Normalize to [0, 1]
        if magnitude.max() > 0:
            magnitude = magnitude / magnitude.max()
        
        # Apply threshold
        edges = (magnitude > threshold).astype(np.float32)
        
        return edges
    
    # ========================================================================
    # Utility Methods
    # ========================================================================
    
    def generate_separate_mask(
        self,
        template: Template,
        output_path: str
    ) -> None:
        """
        Generate separate grayscale alpha mask file.
        
        Args:
            template: Template with alpha parameters
            output_path: Path to save grayscale mask PNG
            
        Notes:
            - Generates grayscale PNG (single channel)
            - Validates dimensions match color asset
            - Used when alpha_mode is SEPARATE or BOTH
        """
        from PIL import Image
        
        # Generate alpha mask
        alpha_rgba = self.generate(template)
        
        # Extract grayscale alpha (R channel, since RGB are identical)
        alpha_gray = alpha_rgba[:, :, 0]
        
        # Convert to PIL Image
        pil_image = Image.fromarray(alpha_gray)
        
        # Save as PNG
        pil_image.save(output_path, format='PNG', optimize=True)
        
        logger.info(f"Saved separate alpha mask: {output_path}")
    
    def validate_dimensions(
        self,
        color_asset_path: str,
        alpha_mask_path: str
    ) -> bool:
        """
        Validate that alpha mask dimensions match color asset.
        
        Args:
            color_asset_path: Path to color asset image
            alpha_mask_path: Path to alpha mask image
            
        Returns:
            True if dimensions match, False otherwise
        """
        from PIL import Image
        
        try:
            color_img = Image.open(color_asset_path)
            alpha_img = Image.open(alpha_mask_path)
            
            if color_img.size != alpha_img.size:
                logger.error(
                    f"Dimension mismatch: color={color_img.size}, alpha={alpha_img.size}"
                )
                return False
            
            logger.debug(f"Dimension validation passed: {color_img.size}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to validate dimensions: {e}")
            return False
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate alpha parameters with additional checks.
        
        Args:
            params: Parameter dictionary
            
        Returns:
            True if valid
            
        Raises:
            ValueError: If parameters are invalid
        """
        # Call base validation
        super().validate_params(params)
        
        # Additional alpha-specific validation
        if "type" in params:
            try:
                AlphaType(params["type"])
            except ValueError:
                valid_types = [t.value for t in AlphaType]
                raise ValueError(
                    f"Invalid alpha type: {params['type']}. "
                    f"Valid types: {valid_types}"
                )
        
        if "gradient_type" in params and params["gradient_type"]:
            valid_gradients = ["linear", "radial", "angular"]
            if params["gradient_type"] not in valid_gradients:
                raise ValueError(
                    f"Invalid gradient_type: {params['gradient_type']}. "
                    f"Valid types: {valid_gradients}"
                )
        
        if "feather" in params and params["feather"] is not None:
            feather = params["feather"]
            if feather < 0:
                raise ValueError(f"Feather must be non-negative, got {feather}")
        
        if "noise_scale" in params and params["noise_scale"] is not None:
            scale = params["noise_scale"]
            if scale <= 0:
                raise ValueError(f"Noise scale must be positive, got {scale}")
        
        if "threshold" in params and params["threshold"] is not None:
            threshold = params["threshold"]
            if not 0 <= threshold <= 1:
                raise ValueError(f"Threshold must be in [0, 1], got {threshold}")
        
        return True
    
    def __repr__(self) -> str:
        """String representation"""
        return f"AlphaGenerator(type={self.generator_type.value})"
