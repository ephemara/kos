"""
UI Forge Shared Utilities

Shared utility functions used across all generators including:
- Color conversion functions (RGB, HSV, HSL)
- Blend mode functions (multiply, screen, overlay, add)
- Anti-aliasing utilities
- File I/O helpers

Design Philosophy:
- Pure functions: No side effects, deterministic outputs
- Numpy-optimized: Vectorized operations for performance
- Type-safe: Full type hints for all functions
- Well-tested: Comprehensive unit test coverage
"""

import numpy as np
from typing import Tuple, Optional, Union
import logging
from pathlib import Path
from PIL import Image
import colorsys


logger = logging.getLogger(__name__)


def image_from_array(image: np.ndarray) -> Image.Image:
    """Convert a numpy image array into a PIL image without deprecated mode hints."""
    if image.dtype != np.uint8:
        image = (np.clip(image, 0, 1) * 255).astype(np.uint8)

    if image.ndim == 2:
        return Image.fromarray(image)

    if image.ndim != 3:
        raise ValueError(f"Unsupported image rank: {image.ndim}")

    channels = image.shape[2]
    if channels in (3, 4):
        return Image.fromarray(image)
    if channels == 1:
        return Image.fromarray(image[:, :, 0])

    raise ValueError(f"Unsupported channel count: {channels}")


# ============================================================================
# Color Conversion Functions
# ============================================================================

def rgb_to_hsv(
    r: Union[int, float, np.ndarray],
    g: Union[int, float, np.ndarray],
    b: Union[int, float, np.ndarray],
    normalized: bool = False
) -> Union[Tuple[float, float, float], np.ndarray]:
    """
    Convert RGB color to HSV color space.
    
    Args:
        r: Red channel (0-255 or 0.0-1.0 if normalized)
        g: Green channel (0-255 or 0.0-1.0 if normalized)
        b: Blue channel (0-255 or 0.0-1.0 if normalized)
        normalized: If True, input is in [0, 1] range, else [0, 255]
        
    Returns:
        Tuple of (H, S, V) where:
        - H (Hue): 0-360 degrees
        - S (Saturation): 0.0-1.0
        - V (Value): 0.0-1.0
        
    For numpy arrays, operates element-wise.
    """
    # Handle numpy arrays
    if isinstance(r, np.ndarray):
        if not normalized:
            r = r.astype(np.float32) / 255.0
            g = g.astype(np.float32) / 255.0
            b = b.astype(np.float32) / 255.0
        
        # Vectorized HSV conversion
        max_val = np.maximum(np.maximum(r, g), b)
        min_val = np.minimum(np.minimum(r, g), b)
        delta = max_val - min_val
        
        # Value
        v = max_val
        
        # Saturation
        s = np.where(max_val > 0, delta / max_val, 0)
        
        # Hue
        h = np.zeros_like(max_val)
        mask_r = (max_val == r) & (delta > 0)
        mask_g = (max_val == g) & (delta > 0)
        mask_b = (max_val == b) & (delta > 0)
        
        h[mask_r] = 60 * (((g[mask_r] - b[mask_r]) / delta[mask_r]) % 6)
        h[mask_g] = 60 * (((b[mask_g] - r[mask_g]) / delta[mask_g]) + 2)
        h[mask_b] = 60 * (((r[mask_b] - g[mask_b]) / delta[mask_b]) + 4)
        
        return np.stack([h, s, v], axis=-1)
    
    # Handle scalar values
    if not normalized:
        r = r / 255.0
        g = g / 255.0
        b = b / 255.0
    
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return (h * 360, s, v)


def hsv_to_rgb(
    h: Union[float, np.ndarray],
    s: Union[float, np.ndarray],
    v: Union[float, np.ndarray],
    normalized: bool = False
) -> Union[Tuple[int, int, int], Tuple[float, float, float], np.ndarray]:
    """
    Convert HSV color to RGB color space.
    
    Args:
        h: Hue (0-360 degrees)
        s: Saturation (0.0-1.0)
        v: Value (0.0-1.0)
        normalized: If True, return [0, 1] range, else [0, 255]
        
    Returns:
        Tuple of (R, G, B) in [0, 255] or [0, 1] range
        For numpy arrays, returns array with same shape
    """
    # Handle numpy arrays
    if isinstance(h, np.ndarray):
        h = h / 360.0  # Normalize to [0, 1]
        
        # Vectorized HSV to RGB conversion
        c = v * s
        x = c * (1 - np.abs(((h * 6) % 2) - 1))
        m = v - c
        
        h_sector = (h * 6).astype(int) % 6
        
        r = np.zeros_like(h)
        g = np.zeros_like(h)
        b = np.zeros_like(h)
        
        mask0 = (h_sector == 0)
        mask1 = (h_sector == 1)
        mask2 = (h_sector == 2)
        mask3 = (h_sector == 3)
        mask4 = (h_sector == 4)
        mask5 = (h_sector == 5)
        
        r[mask0], g[mask0], b[mask0] = c[mask0], x[mask0], 0
        r[mask1], g[mask1], b[mask1] = x[mask1], c[mask1], 0
        r[mask2], g[mask2], b[mask2] = 0, c[mask2], x[mask2]
        r[mask3], g[mask3], b[mask3] = 0, x[mask3], c[mask3]
        r[mask4], g[mask4], b[mask4] = x[mask4], 0, c[mask4]
        r[mask5], g[mask5], b[mask5] = c[mask5], 0, x[mask5]
        
        r += m
        g += m
        b += m
        
        if not normalized:
            r = (r * 255).astype(np.uint8)
            g = (g * 255).astype(np.uint8)
            b = (b * 255).astype(np.uint8)
        
        return np.stack([r, g, b], axis=-1)
    
    # Handle scalar values
    h = h / 360.0  # Normalize to [0, 1]
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    
    if normalized:
        return (r, g, b)
    else:
        return (int(r * 255), int(g * 255), int(b * 255))


def rgb_to_hsl(
    r: Union[int, float, np.ndarray],
    g: Union[int, float, np.ndarray],
    b: Union[int, float, np.ndarray],
    normalized: bool = False
) -> Union[Tuple[float, float, float], np.ndarray]:
    """
    Convert RGB color to HSL color space.
    
    Args:
        r: Red channel (0-255 or 0.0-1.0 if normalized)
        g: Green channel (0-255 or 0.0-1.0 if normalized)
        b: Blue channel (0-255 or 0.0-1.0 if normalized)
        normalized: If True, input is in [0, 1] range, else [0, 255]
        
    Returns:
        Tuple of (H, S, L) where:
        - H (Hue): 0-360 degrees
        - S (Saturation): 0.0-1.0
        - L (Lightness): 0.0-1.0
        
    For numpy arrays, operates element-wise.
    """
    # Handle numpy arrays
    if isinstance(r, np.ndarray):
        if not normalized:
            r = r.astype(np.float32) / 255.0
            g = g.astype(np.float32) / 255.0
            b = b.astype(np.float32) / 255.0
        
        # Vectorized HSL conversion
        max_val = np.maximum(np.maximum(r, g), b)
        min_val = np.minimum(np.minimum(r, g), b)
        delta = max_val - min_val
        
        # Lightness
        l = (max_val + min_val) / 2.0
        
        # Saturation
        s = np.where(
            delta == 0,
            0,
            np.where(l < 0.5, delta / (max_val + min_val), delta / (2.0 - max_val - min_val))
        )
        
        # Hue
        h = np.zeros_like(max_val)
        mask_r = (max_val == r) & (delta > 0)
        mask_g = (max_val == g) & (delta > 0)
        mask_b = (max_val == b) & (delta > 0)
        
        h[mask_r] = 60 * (((g[mask_r] - b[mask_r]) / delta[mask_r]) % 6)
        h[mask_g] = 60 * (((b[mask_g] - r[mask_g]) / delta[mask_g]) + 2)
        h[mask_b] = 60 * (((r[mask_b] - g[mask_b]) / delta[mask_b]) + 4)
        
        return np.stack([h, s, l], axis=-1)
    
    # Handle scalar values
    if not normalized:
        r = r / 255.0
        g = g / 255.0
        b = b / 255.0
    
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (h * 360, s, l)


def hsl_to_rgb(
    h: Union[float, np.ndarray],
    s: Union[float, np.ndarray],
    l: Union[float, np.ndarray],
    normalized: bool = False
) -> Union[Tuple[int, int, int], Tuple[float, float, float], np.ndarray]:
    """
    Convert HSL color to RGB color space.
    
    Args:
        h: Hue (0-360 degrees)
        s: Saturation (0.0-1.0)
        l: Lightness (0.0-1.0)
        normalized: If True, return [0, 1] range, else [0, 255]
        
    Returns:
        Tuple of (R, G, B) in [0, 255] or [0, 1] range
        For numpy arrays, returns array with same shape
    """
    # Handle numpy arrays
    if isinstance(h, np.ndarray):
        h = h / 360.0  # Normalize to [0, 1]
        
        # Vectorized HSL to RGB conversion
        c = (1 - np.abs(2 * l - 1)) * s
        x = c * (1 - np.abs(((h * 6) % 2) - 1))
        m = l - c / 2
        
        h_sector = (h * 6).astype(int) % 6
        
        r = np.zeros_like(h)
        g = np.zeros_like(h)
        b = np.zeros_like(h)
        
        mask0 = (h_sector == 0)
        mask1 = (h_sector == 1)
        mask2 = (h_sector == 2)
        mask3 = (h_sector == 3)
        mask4 = (h_sector == 4)
        mask5 = (h_sector == 5)
        
        r[mask0], g[mask0], b[mask0] = c[mask0], x[mask0], 0
        r[mask1], g[mask1], b[mask1] = x[mask1], c[mask1], 0
        r[mask2], g[mask2], b[mask2] = 0, c[mask2], x[mask2]
        r[mask3], g[mask3], b[mask3] = 0, x[mask3], c[mask3]
        r[mask4], g[mask4], b[mask4] = x[mask4], 0, c[mask4]
        r[mask5], g[mask5], b[mask5] = c[mask5], 0, x[mask5]
        
        r += m
        g += m
        b += m
        
        if not normalized:
            r = (r * 255).astype(np.uint8)
            g = (g * 255).astype(np.uint8)
            b = (b * 255).astype(np.uint8)
        
        return np.stack([r, g, b], axis=-1)
    
    # Handle scalar values
    h = h / 360.0  # Normalize to [0, 1]
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    
    if normalized:
        return (r, g, b)
    else:
        return (int(r * 255), int(g * 255), int(b * 255))


# ============================================================================
# Blend Mode Functions
# ============================================================================

def blend_multiply(
    base: np.ndarray,
    blend: np.ndarray,
    opacity: float = 1.0
) -> np.ndarray:
    """
    Multiply blend mode: darkens the base color.
    
    Args:
        base: Base layer (H, W, C) with values in [0, 1]
        blend: Blend layer (H, W, C) with values in [0, 1]
        opacity: Blend opacity (0.0-1.0)
        
    Returns:
        Blended result (H, W, C) with values in [0, 1]
    """
    result = base * blend
    return base * (1 - opacity) + result * opacity


def blend_screen(
    base: np.ndarray,
    blend: np.ndarray,
    opacity: float = 1.0
) -> np.ndarray:
    """
    Screen blend mode: lightens the base color.
    
    Args:
        base: Base layer (H, W, C) with values in [0, 1]
        blend: Blend layer (H, W, C) with values in [0, 1]
        opacity: Blend opacity (0.0-1.0)
        
    Returns:
        Blended result (H, W, C) with values in [0, 1]
    """
    result = 1 - (1 - base) * (1 - blend)
    return base * (1 - opacity) + result * opacity


def blend_overlay(
    base: np.ndarray,
    blend: np.ndarray,
    opacity: float = 1.0
) -> np.ndarray:
    """
    Overlay blend mode: combines multiply and screen.
    
    Args:
        base: Base layer (H, W, C) with values in [0, 1]
        blend: Blend layer (H, W, C) with values in [0, 1]
        opacity: Blend opacity (0.0-1.0)
        
    Returns:
        Blended result (H, W, C) with values in [0, 1]
    """
    result = np.where(
        base < 0.5,
        2 * base * blend,
        1 - 2 * (1 - base) * (1 - blend)
    )
    return base * (1 - opacity) + result * opacity


def blend_add(
    base: np.ndarray,
    blend: np.ndarray,
    opacity: float = 1.0
) -> np.ndarray:
    """
    Additive blend mode: adds colors together.
    
    Args:
        base: Base layer (H, W, C) with values in [0, 1]
        blend: Blend layer (H, W, C) with values in [0, 1]
        opacity: Blend opacity (0.0-1.0)
        
    Returns:
        Blended result (H, W, C) with values in [0, 1], clamped
    """
    result = np.clip(base + blend, 0, 1)
    return base * (1 - opacity) + result * opacity


# ============================================================================
# Anti-Aliasing Utilities
# ============================================================================

def supersample_downsample(
    image: np.ndarray,
    target_width: int,
    target_height: int,
    method: str = 'lanczos'
) -> np.ndarray:
    """
    Downsample supersampled image with high-quality filtering.
    
    Args:
        image: Supersampled image (H, W, C)
        target_width: Target width
        target_height: Target height
        method: Resampling method ('lanczos', 'bicubic', 'bilinear', 'box')
        
    Returns:
        Downsampled image (target_height, target_width, C)
    """
    # Map method names to PIL resampling filters
    method_map = {
        'lanczos': Image.Resampling.LANCZOS,
        'bicubic': Image.Resampling.BICUBIC,
        'bilinear': Image.Resampling.BILINEAR,
        'box': Image.Resampling.BOX
    }
    
    if method not in method_map:
        raise ValueError(f"Unknown resampling method: {method}")
    
    pil_image = image_from_array(image)
    
    # Resize with specified filter
    pil_image = pil_image.resize(
        (target_width, target_height),
        method_map[method]
    )
    
    # Convert back to numpy
    result = np.array(pil_image)
    
    # Ensure 3D array for single-channel images
    if len(result.shape) == 2:
        result = result[:, :, np.newaxis]
    
    return result


def apply_gaussian_blur(
    image: np.ndarray,
    sigma: float
) -> np.ndarray:
    """
    Apply Gaussian blur for anti-aliasing.
    
    Args:
        image: Input image (H, W, C)
        sigma: Gaussian kernel standard deviation
        
    Returns:
        Blurred image (H, W, C)
    """
    from scipy import ndimage
    
    # Apply blur to each channel separately
    result = np.zeros_like(image, dtype=np.float32)
    
    for c in range(image.shape[2]):
        result[:, :, c] = ndimage.gaussian_filter(
            image[:, :, c].astype(np.float32),
            sigma=sigma
        )
    
    return result.astype(image.dtype)


# ============================================================================
# File I/O Helpers
# ============================================================================

def save_image(
    image: np.ndarray,
    output_path: Union[str, Path],
    format: Optional[str] = None,
    quality: int = 95,
    optimize: bool = True,
    dpi: Tuple[int, int] = (72, 72)
) -> None:
    """
    Save image to file with format-specific options.
    
    Args:
        image: Image array (H, W, C) with uint8 or float data
        output_path: Output file path
        format: Image format (PNG, JPEG, WebP, etc.). Auto-detected if None
        quality: Quality for lossy formats (1-100)
        optimize: Enable optimization for smaller file size
        dpi: DPI metadata (width_dpi, height_dpi)
    """
    output_path = Path(output_path)
    
    # Ensure parent directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Convert to uint8 if needed
    if image.dtype != np.uint8:
        image = (np.clip(image, 0, 1) * 255).astype(np.uint8)
    
    # Create PIL Image
    pil_image = image_from_array(image)
    
    # Prepare save options
    save_kwargs = {
        'format': format,
        'dpi': dpi
    }
    
    # Format-specific options
    if format == 'JPEG' or (format is None and output_path.suffix.lower() in ['.jpg', '.jpeg']):
        save_kwargs['quality'] = quality
        save_kwargs['optimize'] = optimize
        # JPEG doesn't support transparency
        if pil_image.mode == 'RGBA':
            logger.warning("JPEG doesn't support transparency, converting to RGB")
            pil_image = pil_image.convert('RGB')
    
    elif format == 'PNG' or (format is None and output_path.suffix.lower() == '.png'):
        save_kwargs['optimize'] = optimize
        save_kwargs['compress_level'] = 9 if optimize else 6
    
    elif format == 'WEBP' or (format is None and output_path.suffix.lower() == '.webp'):
        save_kwargs['quality'] = quality
        save_kwargs['method'] = 6 if optimize else 4
    
    # Save image
    pil_image.save(output_path, **save_kwargs)
    logger.debug(f"Saved image: {output_path} ({pil_image.mode}, {image.shape[1]}x{image.shape[0]})")


def load_image(
    input_path: Union[str, Path],
    mode: Optional[str] = None
) -> np.ndarray:
    """
    Load image from file.
    
    Args:
        input_path: Input file path
        mode: Target color mode ('RGB', 'RGBA', 'L'). Auto-detected if None
        
    Returns:
        Image array (H, W, C) with uint8 data
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Image not found: {input_path}")
    
    # Load image
    pil_image = Image.open(input_path)
    
    # Convert to target mode if specified
    if mode:
        pil_image = pil_image.convert(mode)
    
    # Convert to numpy array
    image = np.array(pil_image)
    
    # Ensure 3D array for single-channel images
    if len(image.shape) == 2:
        image = image[:, :, np.newaxis]
    
    logger.debug(f"Loaded image: {input_path} ({pil_image.mode}, {image.shape[1]}x{image.shape[0]})")
    
    return image


def get_image_info(input_path: Union[str, Path]) -> dict:
    """
    Get image metadata without loading full image data.
    
    Args:
        input_path: Input file path
        
    Returns:
        Dictionary with image metadata:
        - width: Image width
        - height: Image height
        - mode: Color mode
        - format: Image format
        - dpi: DPI tuple (width_dpi, height_dpi)
        - file_size: File size in bytes
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Image not found: {input_path}")
    
    with Image.open(input_path) as img:
        info = {
            'width': img.width,
            'height': img.height,
            'mode': img.mode,
            'format': img.format,
            'dpi': img.info.get('dpi', (72, 72)),
            'file_size': input_path.stat().st_size
        }
    
    return info



def ensure_directory(path: Union[str, Path]) -> Path:
    """
    Ensure directory exists, creating it if necessary.
    
    Args:
        path: Directory path
        
    Returns:
        Path object for the directory
    """
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    return path


def parse_hex_color(hex_color: str) -> Tuple[int, int, int]:
    """
    Parse hex color string to RGB tuple.
    
    Args:
        hex_color: Hex color string (e.g., "#FF5733" or "#F57")
        
    Returns:
        Tuple of (R, G, B) values (0-255)
        
    Raises:
        ValueError: If hex color format is invalid
    """
    hex_color = hex_color.lstrip('#')
    
    # Handle 3-digit hex codes
    if len(hex_color) == 3:
        hex_color = ''.join([c*2 for c in hex_color])
    
    if len(hex_color) != 6:
        raise ValueError(f"Invalid hex color format: #{hex_color}")
    
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (r, g, b)
    except ValueError:
        raise ValueError(f"Invalid hex color format: #{hex_color}")


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """
    Convert RGB tuple to hex color string.
    
    Args:
        r: Red channel (0-255)
        g: Green channel (0-255)
        b: Blue channel (0-255)
        
    Returns:
        Hex color string (e.g., "#FF5733")
    """
    return f"#{r:02X}{g:02X}{b:02X}"
