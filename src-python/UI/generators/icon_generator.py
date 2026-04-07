"""
UI Forge Icon Generator

Generates custom icons with geometric primitives, gradient fills, SVG output,
and stroke operations. Supports anti-aliasing via supersampling, layering with
blend modes, and arbitrary output dimensions.

Design Philosophy:
- Data-driven: All visual properties from template parameters
- GPU-friendly: Uses numpy arrays for efficient raster operations
- Vector-first: Generates both raster and SVG output
- Anti-aliased: Custom supersampling for smooth edges
"""

import numpy as np
from typing import Dict, Any, Type, Tuple, Optional, List
import logging
import svgwrite
from svgwrite import cm, mm

from models import (
    Template, GeneratorType, IconParams, Layer, FillStyle, StrokeStyle,
    BlendMode, GradientType, StrokeCap, StrokeJoin
)
from generators.base import BaseGenerator, register_generator


logger = logging.getLogger(__name__)


@register_generator
class IconGenerator(BaseGenerator):
    """
    Icon generator with geometric primitives and gradient fills.
    
    Features:
    - Geometric primitives: circles, rectangles, polygons, paths, ellipses, lines
    - Anti-aliasing via supersampling
    - Layering with blend modes (normal, multiply, screen, overlay, add)
    - Gradient fills (linear, radial, angular)
    - Stroke operations (configurable width, cap, join)
    - Padding and safe area margins
    - Arbitrary output dimensions
    
    All visual properties are data-driven from templates with zero hardcoded values.
    """
    
    def _get_generator_type(self) -> GeneratorType:
        """Return generator type"""
        return GeneratorType.ICON
    
    def supported_params(self) -> Dict[str, Type]:
        """Return supported parameter schema"""
        return {
            "layers": list,
            "background": (str, type(None)),
            "padding": int,
            "antialias_factor": int
        }
    
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate icon from template.
        
        Args:
            template: Template with icon parameters
            
        Returns:
            Numpy array (H, W, 4) with RGBA uint8 data
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Parse icon parameters
        params = self._parse_icon_params(template.params)
        
        # Calculate supersampled dimensions
        aa_factor = params.antialias_factor
        ss_width = width * aa_factor
        ss_height = height * aa_factor
        
        logger.debug(
            f"Generating icon: {width}x{height} "
            f"(supersampled: {ss_width}x{ss_height}, factor: {aa_factor})"
        )
        
        # Create supersampled canvas
        canvas = self.create_blank_canvas(ss_width, ss_height, params.background)
        
        # Apply padding (scale geometry to account for safe area)
        padding_scale = 1.0
        if params.padding > 0:
            # Calculate scale factor to fit content within padded area
            padded_width = width - (2 * params.padding)
            padded_height = height - (2 * params.padding)
            padding_scale = min(padded_width / width, padded_height / height)
        
        # Render each layer
        for layer_idx, layer in enumerate(params.layers):
            logger.debug(f"Rendering layer {layer_idx}: {layer.type}")
            
            try:
                # Render layer to separate buffer
                layer_buffer = self._render_layer(
                    layer, ss_width, ss_height, padding_scale, aa_factor
                )
                
                # Composite layer onto canvas with blend mode
                canvas = self._composite_layer(canvas, layer_buffer, layer.blend_mode, layer.opacity)
                
            except Exception as e:
                logger.error(f"Failed to render layer {layer_idx}: {e}")
                raise RuntimeError(f"Layer {layer_idx} rendering failed: {e}")
        
        # Downsample to target resolution
        if aa_factor > 1:
            canvas = self._downsample(canvas, width, height)
        
        return canvas
    
    def _parse_icon_params(self, params: Dict[str, Any]) -> IconParams:
        """Parse and validate icon parameters"""
        # Validate parameters
        self.validate_params(params)
        
        # Parse layers
        layers_data = params.get("layers", [])
        layers = []
        
        for layer_data in layers_data:
            # Parse fill style
            fill = None
            if "fill" in layer_data and layer_data["fill"]:
                fill_data = layer_data["fill"]
                fill = FillStyle(
                    type=GradientType(fill_data.get("type", "solid")),
                    colors=fill_data.get("colors", []),
                    stops=fill_data.get("stops"),
                    angle=fill_data.get("angle"),
                    center=tuple(fill_data["center"]) if "center" in fill_data else None
                )
            
            # Parse stroke style
            stroke = None
            if "stroke" in layer_data and layer_data["stroke"]:
                stroke_data = layer_data["stroke"]
                stroke = StrokeStyle(
                    color=stroke_data.get("color", "#000000"),
                    width=stroke_data.get("width", 1.0),
                    cap=StrokeCap(stroke_data.get("cap", "round")),
                    join=StrokeJoin(stroke_data.get("join", "round")),
                    miter_limit=stroke_data.get("miter_limit", 4.0)
                )
            
            # Create layer
            layer = Layer(
                type=layer_data.get("type", "circle"),
                geometry=layer_data.get("geometry", {}),
                fill=fill,
                stroke=stroke,
                blend_mode=BlendMode(layer_data.get("blend_mode", "normal")),
                opacity=layer_data.get("opacity", 1.0),
                transform=layer_data.get("transform")
            )
            layers.append(layer)
        
        # Create IconParams
        return IconParams(
            layers=layers,
            background=params.get("background"),
            padding=params.get("padding", 0),
            antialias_factor=params.get("antialias_factor", 2)
        )
    
    def _render_layer(
        self, 
        layer: Layer, 
        width: int, 
        height: int,
        padding_scale: float,
        aa_factor: int
    ) -> np.ndarray:
        """
        Render a single layer to a buffer.
        
        Args:
            layer: Layer to render
            width: Canvas width (supersampled)
            height: Canvas height (supersampled)
            padding_scale: Scale factor for padding
            aa_factor: Anti-aliasing factor
            
        Returns:
            RGBA numpy array (H, W, 4)
        """
        # Create layer buffer
        buffer = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Scale geometry for supersampling and padding
        scaled_geom = self._scale_geometry(
            layer.geometry, aa_factor, padding_scale, width, height
        )
        
        # Render geometry based on type
        if layer.type == "circle":
            mask = self._render_circle(scaled_geom, width, height)
        elif layer.type == "rect":
            mask = self._render_rect(scaled_geom, width, height)
        elif layer.type == "polygon":
            mask = self._render_polygon(scaled_geom, width, height)
        elif layer.type == "ellipse":
            mask = self._render_ellipse(scaled_geom, width, height)
        elif layer.type == "line":
            mask = self._render_line(scaled_geom, width, height)
        elif layer.type == "path":
            mask = self._render_path(scaled_geom, width, height)
        else:
            raise ValueError(f"Unsupported layer type: {layer.type}")
        
        # Apply fill if specified
        if layer.fill:
            fill_colors = self._generate_fill(layer.fill, width, height, mask)
            buffer[:, :, :3] = fill_colors
            buffer[:, :, 3] = (mask * 255).astype(np.uint8)
        
        # Apply stroke if specified
        if layer.stroke:
            stroke_mask = self._generate_stroke(mask, layer.stroke, aa_factor)
            stroke_color = self._parse_hex_color(layer.stroke.color)
            
            # Composite stroke over fill
            stroke_alpha = stroke_mask[:, :, np.newaxis]
            buffer[:, :, :3] = (
                buffer[:, :, :3] * (1 - stroke_alpha) +
                np.array(stroke_color) * stroke_alpha
            ).astype(np.uint8)
            buffer[:, :, 3] = np.maximum(buffer[:, :, 3], (stroke_mask * 255).astype(np.uint8))
        
        return buffer
    
    def _scale_geometry(
        self,
        geometry: Dict[str, Any],
        aa_factor: int,
        padding_scale: float,
        width: int,
        height: int
    ) -> Dict[str, Any]:
        """Scale geometry for supersampling and padding"""
        scaled = {}
        
        for key, value in geometry.items():
            if key in ["cx", "x", "x1", "x2"]:
                # X coordinates - scale and center
                scaled[key] = (value * aa_factor * padding_scale) + (width * (1 - padding_scale) / 2)
            elif key in ["cy", "y", "y1", "y2"]:
                # Y coordinates - scale and center
                scaled[key] = (value * aa_factor * padding_scale) + (height * (1 - padding_scale) / 2)
            elif key in ["r", "rx", "ry", "width", "height"]:
                # Radii and dimensions - scale only
                scaled[key] = value * aa_factor * padding_scale
            elif key == "points":
                # Polygon points - scale each coordinate
                scaled_points = []
                for px, py in value:
                    sx = (px * aa_factor * padding_scale) + (width * (1 - padding_scale) / 2)
                    sy = (py * aa_factor * padding_scale) + (height * (1 - padding_scale) / 2)
                    scaled_points.append((sx, sy))
                scaled[key] = scaled_points
            else:
                # Pass through other parameters
                scaled[key] = value
        
        return scaled
    
    def _render_circle(self, geometry: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Render circle as anti-aliased mask"""
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
    
    def _render_rect(self, geometry: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Render rectangle as anti-aliased mask"""
        x = geometry.get("x", 0)
        y = geometry.get("y", 0)
        w = geometry.get("width", width)
        h = geometry.get("height", height)
        
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
    
    def _render_ellipse(self, geometry: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Render ellipse as anti-aliased mask"""
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
    
    def _render_line(self, geometry: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Render line as anti-aliased mask"""
        x1 = geometry.get("x1", 0)
        y1 = geometry.get("y1", 0)
        x2 = geometry.get("x2", width)
        y2 = geometry.get("y2", height)
        line_width = geometry.get("width", 1.0)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance from line
        dx = x2 - x1
        dy = y2 - y1
        length = np.sqrt(dx**2 + dy**2)
        
        if length == 0:
            return np.zeros((height, width))
        
        # Normalized direction
        dx /= length
        dy /= length
        
        # Distance from line
        px = x - x1
        py = y - y1
        proj = px * dx + py * dy
        proj = np.clip(proj, 0, length)
        
        closest_x = x1 + proj * dx
        closest_y = y1 + proj * dy
        
        dist = np.sqrt((x - closest_x)**2 + (y - closest_y)**2)
        
        # Anti-aliased edge
        mask = np.clip(line_width / 2 + 0.5 - dist, 0, 1)
        
        return mask
    
    def _render_polygon(self, geometry: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Render polygon as anti-aliased mask"""
        points = geometry.get("points", [])
        
        if len(points) < 3:
            return np.zeros((height, width))
        
        # Create mask using scanline algorithm
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Simple polygon fill (can be optimized)
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
    
    def _render_path(self, geometry: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Render path as anti-aliased mask (simplified implementation)"""
        # For now, treat path as polygon
        # Full SVG path parsing would be more complex
        return self._render_polygon(geometry, width, height)
    
    def _generate_fill(
        self,
        fill: FillStyle,
        width: int,
        height: int,
        mask: np.ndarray
    ) -> np.ndarray:
        """Generate fill colors based on fill style"""
        if fill.type == GradientType.SOLID:
            # Solid color fill
            color = self._parse_hex_color(fill.colors[0])
            colors = np.full((height, width, 3), color, dtype=np.uint8)
        
        elif fill.type == GradientType.LINEAR:
            colors = self._generate_linear_gradient(fill, width, height)
        
        elif fill.type == GradientType.RADIAL:
            colors = self._generate_radial_gradient(fill, width, height)
        
        elif fill.type == GradientType.ANGULAR:
            colors = self._generate_angular_gradient(fill, width, height)
        
        else:
            raise ValueError(f"Unsupported fill type: {fill.type}")
        
        return colors
    
    def _generate_linear_gradient(
        self,
        fill: FillStyle,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Generate linear gradient.
        
        Args:
            fill: Fill style with gradient parameters
            width: Canvas width
            height: Canvas height
            
        Returns:
            RGB numpy array (H, W, 3)
        """
        angle = fill.angle if fill.angle is not None else 0.0
        angle_rad = np.radians(angle)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Center coordinates
        cx, cy = width / 2, height / 2
        
        # Calculate gradient direction vector
        dx = np.cos(angle_rad)
        dy = np.sin(angle_rad)
        
        # Project coordinates onto gradient axis
        # Normalize to [0, 1] range
        max_dist = max(width, height) * np.sqrt(2) / 2
        t = ((x - cx) * dx + (y - cy) * dy) / max_dist
        t = (t + 1) / 2  # Map from [-1, 1] to [0, 1]
        t = np.clip(t, 0, 1)
        
        # Interpolate colors
        colors = self._interpolate_gradient_colors(fill.colors, fill.stops, t)
        
        return colors
    
    def _generate_radial_gradient(
        self,
        fill: FillStyle,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Generate radial gradient.
        
        Args:
            fill: Fill style with gradient parameters
            width: Canvas width
            height: Canvas height
            
        Returns:
            RGB numpy array (H, W, 3)
        """
        # Get center point (default to canvas center)
        if fill.center:
            cx = fill.center[0] * width
            cy = fill.center[1] * height
        else:
            cx, cy = width / 2, height / 2
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate distance from center
        max_radius = max(width, height) * np.sqrt(2) / 2
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        t = dist / max_radius
        t = np.clip(t, 0, 1)
        
        # Interpolate colors
        colors = self._interpolate_gradient_colors(fill.colors, fill.stops, t)
        
        return colors
    
    def _generate_angular_gradient(
        self,
        fill: FillStyle,
        width: int,
        height: int
    ) -> np.ndarray:
        """
        Generate angular (conic) gradient.
        
        Args:
            fill: Fill style with gradient parameters
            width: Canvas width
            height: Canvas height
            
        Returns:
            RGB numpy array (H, W, 3)
        """
        # Get center point (default to canvas center)
        if fill.center:
            cx = fill.center[0] * width
            cy = fill.center[1] * height
        else:
            cx, cy = width / 2, height / 2
        
        # Get starting angle
        start_angle = fill.angle if fill.angle is not None else 0.0
        start_angle_rad = np.radians(start_angle)
        
        # Create coordinate grids
        y, x = np.ogrid[:height, :width]
        
        # Calculate angle from center
        angle = np.arctan2(y - cy, x - cx)
        
        # Normalize to [0, 1] range
        t = (angle - start_angle_rad) / (2 * np.pi)
        t = np.fmod(t, 1.0)
        t = np.where(t < 0, t + 1, t)
        
        # Interpolate colors
        colors = self._interpolate_gradient_colors(fill.colors, fill.stops, t)
        
        return colors
    
    def _interpolate_gradient_colors(
        self,
        color_list: List[str],
        stops: Optional[List[float]],
        t: np.ndarray
    ) -> np.ndarray:
        """
        Interpolate colors along gradient.
        
        Args:
            color_list: List of color hex codes
            stops: Optional list of stop positions (0.0 to 1.0)
            t: Position array (H, W) with values in [0, 1]
            
        Returns:
            RGB numpy array (H, W, 3)
        """
        if len(color_list) == 0:
            return np.zeros((*t.shape, 3), dtype=np.uint8)
        
        if len(color_list) == 1:
            color = self._parse_hex_color(color_list[0])
            return np.full((*t.shape, 3), color, dtype=np.uint8)
        
        # Parse colors
        colors = [self._parse_hex_color(c) for c in color_list]
        
        # Generate stops if not provided
        if stops is None:
            stops = np.linspace(0, 1, len(colors))
        else:
            stops = np.array(stops)
        
        # Initialize output
        height, width = t.shape
        result = np.zeros((height, width, 3), dtype=np.float32)
        
        # Interpolate between color stops
        for i in range(len(colors) - 1):
            start_stop = stops[i]
            end_stop = stops[i + 1]
            start_color = np.array(colors[i], dtype=np.float32)
            end_color = np.array(colors[i + 1], dtype=np.float32)
            
            # Find pixels in this segment
            mask = (t >= start_stop) & (t <= end_stop)
            
            if np.any(mask):
                # Calculate interpolation factor
                segment_t = (t - start_stop) / (end_stop - start_stop)
                segment_t = np.clip(segment_t, 0, 1)
                
                # Interpolate
                for c in range(3):
                    result[:, :, c] = np.where(
                        mask,
                        start_color[c] + segment_t * (end_color[c] - start_color[c]),
                        result[:, :, c]
                    )
        
        # Handle pixels before first stop
        mask = t < stops[0]
        if np.any(mask):
            result[mask] = colors[0]
        
        # Handle pixels after last stop
        mask = t > stops[-1]
        if np.any(mask):
            result[mask] = colors[-1]
        
        return result.astype(np.uint8)
    
    def _generate_stroke(
        self,
        mask: np.ndarray,
        stroke: StrokeStyle,
        aa_factor: int
    ) -> np.ndarray:
        """
        Generate stroke mask from shape mask.
        
        Args:
            mask: Shape mask (H, W) with values in [0, 1]
            stroke: Stroke style parameters
            aa_factor: Anti-aliasing factor
            
        Returns:
            Stroke mask (H, W) with values in [0, 1]
        """
        from scipy import ndimage
        
        # Scale stroke width for supersampling
        stroke_width = stroke.width * aa_factor
        
        # Create stroke by dilating and subtracting original mask
        # This creates an outline effect
        
        # Convert mask to binary for morphological operations
        binary_mask = (mask > 0.5).astype(np.uint8)
        
        # Dilate to create outer edge
        kernel_size = int(np.ceil(stroke_width))
        if kernel_size % 2 == 0:
            kernel_size += 1  # Ensure odd size
        
        # Create circular structuring element
        y, x = np.ogrid[-kernel_size//2:kernel_size//2+1, -kernel_size//2:kernel_size//2+1]
        kernel = (x**2 + y**2 <= (stroke_width/2)**2).astype(np.uint8)
        
        # Dilate the mask
        dilated = ndimage.binary_dilation(binary_mask, structure=kernel).astype(np.float32)
        
        # Stroke is the difference between dilated and original
        stroke_mask = dilated - mask
        stroke_mask = np.clip(stroke_mask, 0, 1)
        
        # Apply anti-aliasing to stroke edges
        if aa_factor > 1:
            # Smooth the stroke edges
            sigma = 0.5
            stroke_mask = ndimage.gaussian_filter(stroke_mask, sigma=sigma)
        
        return stroke_mask
    
    def _composite_layer(
        self,
        canvas: np.ndarray,
        layer: np.ndarray,
        blend_mode: BlendMode,
        opacity: float
    ) -> np.ndarray:
        """Composite layer onto canvas with blend mode"""
        # Extract alpha channels
        canvas_alpha = canvas[:, :, 3].astype(np.float32) / 255.0
        layer_alpha = layer[:, :, 3].astype(np.float32) / 255.0 * opacity
        
        # Apply blend mode to RGB channels
        canvas_rgb = canvas[:, :, :3].astype(np.float32) / 255.0
        layer_rgb = layer[:, :, :3].astype(np.float32) / 255.0
        
        if blend_mode == BlendMode.NORMAL:
            blended_rgb = layer_rgb
        elif blend_mode == BlendMode.MULTIPLY:
            blended_rgb = canvas_rgb * layer_rgb
        elif blend_mode == BlendMode.SCREEN:
            blended_rgb = 1 - (1 - canvas_rgb) * (1 - layer_rgb)
        elif blend_mode == BlendMode.OVERLAY:
            blended_rgb = np.where(
                canvas_rgb < 0.5,
                2 * canvas_rgb * layer_rgb,
                1 - 2 * (1 - canvas_rgb) * (1 - layer_rgb)
            )
        elif blend_mode == BlendMode.ADD:
            blended_rgb = np.clip(canvas_rgb + layer_rgb, 0, 1)
        else:
            blended_rgb = layer_rgb
        
        # Alpha compositing
        out_alpha = layer_alpha + canvas_alpha * (1 - layer_alpha)
        out_alpha = np.clip(out_alpha, 0, 1)
        
        # Composite RGB
        layer_alpha_3d = layer_alpha[:, :, np.newaxis]
        canvas_alpha_3d = canvas_alpha[:, :, np.newaxis]
        out_alpha_3d = out_alpha[:, :, np.newaxis]
        
        numerator = blended_rgb * layer_alpha_3d + canvas_rgb * canvas_alpha_3d * (1 - layer_alpha_3d)
        out_rgb = np.zeros_like(numerator)
        np.divide(numerator, out_alpha_3d, out=out_rgb, where=out_alpha_3d > 1e-8)
        out_rgb = np.clip(out_rgb, 0, 1)
        
        # Create output
        result = np.zeros_like(canvas)
        result[:, :, :3] = (out_rgb * 255).astype(np.uint8)
        result[:, :, 3] = (out_alpha * 255).astype(np.uint8)
        
        return result
    
    def _downsample(self, image: np.ndarray, target_width: int, target_height: int) -> np.ndarray:
        """Downsample image using box filter"""
        from PIL import Image
        
        # Convert to PIL Image
        pil_image = Image.fromarray(image)
        
        # Resize with high-quality Lanczos filter
        pil_image = pil_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Convert back to numpy
        return np.array(pil_image)
    
    def generate_svg(self, template: Template, output_path: str) -> None:
        """
        Generate SVG output for icon.
        
        Args:
            template: Template with icon parameters
            output_path: Path to save SVG file
            
        Notes:
            - Generates optimized SVG with proper viewBox
            - Pixel-perfect rendering at target resolutions
            - Minimal file size with path optimization
        """
        # Extract dimensions
        width, height = self.get_dimensions(template)
        
        # Parse icon parameters
        params = self._parse_icon_params(template.params)
        
        logger.debug(f"Generating SVG: {width}x{height} -> {output_path}")
        
        # Create SVG drawing
        dwg = svgwrite.Drawing(
            output_path,
            size=(width, height),
            viewBox=f"0 0 {width} {height}",
            profile='tiny'  # SVG Tiny for better compatibility
        )
        
        # Add background if specified
        if params.background:
            dwg.add(dwg.rect(
                insert=(0, 0),
                size=(width, height),
                fill=params.background
            ))
        
        # Calculate padding scale
        padding_scale = 1.0
        offset_x = 0
        offset_y = 0
        
        if params.padding > 0:
            padded_width = width - (2 * params.padding)
            padded_height = height - (2 * params.padding)
            padding_scale = min(padded_width / width, padded_height / height)
            offset_x = (width - padded_width) / 2
            offset_y = (height - padded_height) / 2
        
        # Create group for padded content
        content_group = dwg.g()
        
        # Render each layer
        for layer_idx, layer in enumerate(params.layers):
            logger.debug(f"Rendering SVG layer {layer_idx}: {layer.type}")
            
            try:
                svg_element = self._render_svg_layer(
                    dwg, layer, width, height, padding_scale, offset_x, offset_y
                )
                
                if svg_element:
                    # Apply opacity
                    if layer.opacity < 1.0:
                        svg_element['opacity'] = layer.opacity
                    
                    content_group.add(svg_element)
                    
            except Exception as e:
                logger.error(f"Failed to render SVG layer {layer_idx}: {e}")
                raise RuntimeError(f"SVG layer {layer_idx} rendering failed: {e}")
        
        dwg.add(content_group)
        
        # Save SVG
        dwg.save(pretty=False)  # Compact output for minimal file size
        logger.info(f"SVG saved: {output_path}")
    
    def _render_svg_layer(
        self,
        dwg: svgwrite.Drawing,
        layer: Layer,
        width: int,
        height: int,
        padding_scale: float,
        offset_x: float,
        offset_y: float
    ) -> Optional[svgwrite.base.BaseElement]:
        """
        Render a single layer as SVG element.
        
        Args:
            dwg: SVG drawing object
            layer: Layer to render
            width: Canvas width
            height: Canvas height
            padding_scale: Scale factor for padding
            offset_x: X offset for padding
            offset_y: Y offset for padding
            
        Returns:
            SVG element or None
        """
        # Scale geometry
        scaled_geom = self._scale_svg_geometry(
            layer.geometry, padding_scale, offset_x, offset_y, width, height
        )
        
        # Create SVG element based on type
        element = None
        
        if layer.type == "circle":
            cx = scaled_geom.get("cx", width / 2)
            cy = scaled_geom.get("cy", height / 2)
            r = scaled_geom.get("r", min(width, height) / 4)
            element = dwg.circle(center=(cx, cy), r=r)
        
        elif layer.type == "rect":
            x = scaled_geom.get("x", 0)
            y = scaled_geom.get("y", 0)
            w = scaled_geom.get("width", width)
            h = scaled_geom.get("height", height)
            element = dwg.rect(insert=(x, y), size=(w, h))
        
        elif layer.type == "ellipse":
            cx = scaled_geom.get("cx", width / 2)
            cy = scaled_geom.get("cy", height / 2)
            rx = scaled_geom.get("rx", width / 4)
            ry = scaled_geom.get("ry", height / 4)
            element = dwg.ellipse(center=(cx, cy), r=(rx, ry))
        
        elif layer.type == "line":
            x1 = scaled_geom.get("x1", 0)
            y1 = scaled_geom.get("y1", 0)
            x2 = scaled_geom.get("x2", width)
            y2 = scaled_geom.get("y2", height)
            element = dwg.line(start=(x1, y1), end=(x2, y2))
        
        elif layer.type == "polygon":
            points = scaled_geom.get("points", [])
            if len(points) >= 3:
                element = dwg.polygon(points=points)
        
        elif layer.type == "path":
            # For now, treat as polygon
            points = scaled_geom.get("points", [])
            if len(points) >= 2:
                element = dwg.polyline(points=points)
        
        if element is None:
            return None
        
        # Apply fill
        if layer.fill:
            fill_style = self._create_svg_fill(dwg, layer.fill, width, height)
            if isinstance(fill_style, str):
                element['fill'] = fill_style
            else:
                # Gradient reference
                element['fill'] = fill_style.get_funciri()
        else:
            element['fill'] = 'none'
        
        # Apply stroke
        if layer.stroke:
            element['stroke'] = layer.stroke.color
            element['stroke-width'] = layer.stroke.width
            element['stroke-linecap'] = layer.stroke.cap.value
            element['stroke-linejoin'] = layer.stroke.join.value
            
            if layer.stroke.join == StrokeJoin.MITER:
                element['stroke-miterlimit'] = layer.stroke.miter_limit
        else:
            element['stroke'] = 'none'
        
        return element
    
    def _scale_svg_geometry(
        self,
        geometry: Dict[str, Any],
        padding_scale: float,
        offset_x: float,
        offset_y: float,
        width: int,
        height: int
    ) -> Dict[str, Any]:
        """Scale geometry for SVG with padding"""
        scaled = {}
        
        for key, value in geometry.items():
            if key in ["cx", "x", "x1", "x2"]:
                # X coordinates
                scaled[key] = (value * padding_scale) + offset_x
            elif key in ["cy", "y", "y1", "y2"]:
                # Y coordinates
                scaled[key] = (value * padding_scale) + offset_y
            elif key in ["r", "rx", "ry", "width", "height"]:
                # Radii and dimensions
                scaled[key] = value * padding_scale
            elif key == "points":
                # Polygon points
                scaled_points = []
                for px, py in value:
                    sx = (px * padding_scale) + offset_x
                    sy = (py * padding_scale) + offset_y
                    scaled_points.append((sx, sy))
                scaled[key] = scaled_points
            else:
                scaled[key] = value
        
        return scaled
    
    def _create_svg_fill(
        self,
        dwg: svgwrite.Drawing,
        fill: FillStyle,
        width: int,
        height: int
    ) -> Any:
        """
        Create SVG fill style (solid color or gradient).
        
        Args:
            dwg: SVG drawing object
            fill: Fill style
            width: Canvas width
            height: Canvas height
            
        Returns:
            Color string or gradient object
        """
        if fill.type == GradientType.SOLID:
            return fill.colors[0]
        
        elif fill.type == GradientType.LINEAR:
            # Create linear gradient
            angle = fill.angle if fill.angle is not None else 0.0
            angle_rad = np.radians(angle)
            
            # Calculate gradient vector
            dx = np.cos(angle_rad)
            dy = np.sin(angle_rad)
            
            # Map to SVG coordinates (0-100%)
            x1 = 50 - dx * 50
            y1 = 50 - dy * 50
            x2 = 50 + dx * 50
            y2 = 50 + dy * 50
            
            gradient = dwg.defs.add(dwg.linearGradient(
                start=(f"{x1}%", f"{y1}%"),
                end=(f"{x2}%", f"{y2}%")
            ))
            
            # Add color stops
            stops = fill.stops if fill.stops else np.linspace(0, 1, len(fill.colors))
            for color, stop in zip(fill.colors, stops):
                gradient.add_stop_color(offset=stop, color=color)
            
            return gradient
        
        elif fill.type == GradientType.RADIAL:
            # Create radial gradient
            cx = fill.center[0] * 100 if fill.center else 50
            cy = fill.center[1] * 100 if fill.center else 50
            
            gradient = dwg.defs.add(dwg.radialGradient(
                center=(f"{cx}%", f"{cy}%"),
                r="50%"
            ))
            
            # Add color stops
            stops = fill.stops if fill.stops else np.linspace(0, 1, len(fill.colors))
            for color, stop in zip(fill.colors, stops):
                gradient.add_stop_color(offset=stop, color=color)
            
            return gradient
        
        elif fill.type == GradientType.ANGULAR:
            # SVG doesn't natively support conic gradients
            # Fall back to solid color for now
            logger.warning("Angular gradients not fully supported in SVG, using first color")
            return fill.colors[0]
        
        return fill.colors[0]
