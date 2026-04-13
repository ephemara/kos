"""
UI Forge Sprite Sheet Generator

Generates sprite sheets (PNG images with multiple animation frames) from motion
configurations. Includes metadata JSON for frame count, dimensions, and playback info.

Sprite sheets are useful for:
- Game engines that don't support SMIL
- Canvas-based animations
- High-performance playback without SVG overhead

Requirements: 16.8
"""

import logging
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from PIL import Image, ImageDraw

from models import AnimationConfig, SpriteSheetLayout
from animation.motion_library import get_motion_function, compose_motions
from utils import image_from_array


logger = logging.getLogger(__name__)


# ============================================================================
# Sprite Sheet Generation
# ============================================================================

def generate_animation_frames(
    base_image: np.ndarray,
    animation_config: AnimationConfig,
) -> List[np.ndarray]:
    """
    Generate transformed animation frames from a static base image.

    Centralizing frame generation keeps sprite sheets, APNG, and any future
    animation exporters on the same sampling logic.
    """
    generator = SpriteSheetGenerator()
    return generator._generate_frames(base_image, animation_config)

class SpriteSheetGenerator:
    """
    Generates sprite sheets from static images and motion configurations.
    
    Workflow:
    1. Load static image (base frame)
    2. Sample motion functions to generate transforms
    3. Render each frame with applied transform
    4. Composite frames into sprite sheet grid
    5. Generate metadata JSON
    
    Usage:
        generator = SpriteSheetGenerator()
        sprite_path, metadata_path = generator.generate_sprite_sheet(
            base_image=image_array,
            animation_config=config,
            output_path="sprite.png"
        )
    """
    
    def __init__(self):
        """Initialize sprite sheet generator."""
        pass
    
    def generate_sprite_sheet(
        self,
        base_image: np.ndarray,
        animation_config: AnimationConfig,
        output_path: Path,
        background_color: Optional[Tuple[int, int, int, int]] = None,
    ) -> Tuple[Optional[Path], Optional[Path]]:
        """
        Generate sprite sheet from base image and animation configuration.
        
        Args:
            base_image: Base image as numpy array (H, W, C)
            animation_config: Animation configuration
            output_path: Output path for sprite sheet PNG
            background_color: Background color as (R, G, B, A) tuple (default: transparent)
            
        Returns:
            Tuple of (sprite_sheet_path, metadata_path) or (None, None) if failed
        """
        try:
            # Generate frames
            frames = generate_animation_frames(base_image, animation_config)
            
            if not frames:
                logger.error("No frames generated")
                return None, None
            
            # Determine layout
            layout = animation_config.sprite_sheet_layout or SpriteSheetLayout.GRID
            
            # Composite frames into sprite sheet
            sprite_sheet = self._composite_sprite_sheet(
                frames,
                layout,
                background_color,
            )
            
            # Save sprite sheet
            self._save_sprite_sheet(sprite_sheet, output_path)
            
            # Generate metadata
            metadata = self._generate_metadata(
                frames,
                layout,
                animation_config,
                output_path,
            )
            
            # Save metadata
            metadata_path = output_path.with_suffix('.json')
            self._save_metadata(metadata, metadata_path)
            
            logger.info(
                f"Generated sprite sheet: {output_path} "
                f"({len(frames)} frames, {layout.value} layout)"
            )
            
            return output_path, metadata_path
            
        except Exception as e:
            logger.error(f"Failed to generate sprite sheet: {e}")
            return None, None
    
    def _generate_frames(
        self,
        base_image: np.ndarray,
        animation_config: AnimationConfig,
    ) -> List[np.ndarray]:
        """
        Generate animation frames by applying transforms to base image.
        
        Args:
            base_image: Base image as numpy array (H, W, C)
            animation_config: Animation configuration
            
        Returns:
            List of frame arrays
        """
        num_frames = int(animation_config.duration * animation_config.fps)
        frames = []
        
        # Prepare motion configurations
        motion_configs = []
        for motion_type in animation_config.motion_types:
            params = animation_config.motion_params.get(motion_type.value, {})
            motion_configs.append((motion_type.value, params))
        
        # Generate each frame
        for frame_idx in range(num_frames):
            t = frame_idx / num_frames if num_frames > 0 else 0.0
            
            # Get composed transform
            if len(motion_configs) == 1:
                motion_type, params = motion_configs[0]
                motion_func = get_motion_function(motion_type)
                transform = motion_func(t, params)
            else:
                transform = compose_motions(t, motion_configs)
            
            # Apply transform to base image
            frame = self._apply_transform(base_image, transform)
            frames.append(frame)
        
        return frames
    
    def _apply_transform(
        self,
        image: np.ndarray,
        transform: Dict[str, Any],
    ) -> np.ndarray:
        """
        Apply transform to image using PIL.
        
        Args:
            image: Image as numpy array (H, W, C)
            transform: Transform dictionary with translate, rotate, scale
            
        Returns:
            Transformed image as numpy array
        """
        # Convert to PIL Image
        pil_image = image_from_array(image)
        
        # Extract transform values
        tx, ty = transform['translate']
        rotate = transform['rotate']
        sx, sy = transform['scale']
        
        # Create canvas with extra space for transforms
        width, height = pil_image.size
        canvas_size = (int(width * 2), int(height * 2))
        canvas = Image.new(pil_image.mode, canvas_size, (0, 0, 0, 0))
        
        # Calculate center position
        center_x = canvas_size[0] // 2
        center_y = canvas_size[1] // 2
        
        # Apply scale
        if abs(sx - 1.0) > 0.01 or abs(sy - 1.0) > 0.01:
            new_width = int(width * sx)
            new_height = int(height * sy)
            if new_width > 0 and new_height > 0:
                pil_image = pil_image.resize((new_width, new_height), Image.LANCZOS)
        
        # Apply rotation
        if abs(rotate) > 0.01:
            pil_image = pil_image.rotate(-rotate, expand=True, resample=Image.BICUBIC)
        
        # Apply translation and paste to canvas
        paste_x = center_x - pil_image.width // 2 + int(tx)
        paste_y = center_y - pil_image.height // 2 + int(ty)
        
        if pil_image.mode == 'RGBA':
            canvas.paste(pil_image, (paste_x, paste_y), pil_image)
        else:
            canvas.paste(pil_image, (paste_x, paste_y))
        
        # Crop back to original size
        crop_box = (
            center_x - width // 2,
            center_y - height // 2,
            center_x + width // 2,
            center_y + height // 2,
        )
        canvas = canvas.crop(crop_box)
        
        # Convert back to numpy
        return np.array(canvas)
    
    def _composite_sprite_sheet(
        self,
        frames: List[np.ndarray],
        layout: SpriteSheetLayout,
        background_color: Optional[Tuple[int, int, int, int]] = None,
    ) -> np.ndarray:
        """
        Composite frames into sprite sheet grid.
        
        Args:
            frames: List of frame arrays
            layout: Sprite sheet layout type
            background_color: Background color (default: transparent)
            
        Returns:
            Sprite sheet as numpy array
        """
        if not frames:
            raise ValueError("No frames to composite")
        
        frame_height, frame_width, channels = frames[0].shape
        num_frames = len(frames)
        
        # Determine grid dimensions
        if layout == SpriteSheetLayout.HORIZONTAL:
            cols = num_frames
            rows = 1
        elif layout == SpriteSheetLayout.VERTICAL:
            cols = 1
            rows = num_frames
        else:  # GRID
            # Calculate optimal grid (roughly square)
            cols = int(np.ceil(np.sqrt(num_frames)))
            rows = int(np.ceil(num_frames / cols))
        
        # Create sprite sheet canvas
        sheet_width = cols * frame_width
        sheet_height = rows * frame_height
        
        if background_color is None:
            # Transparent background
            if channels == 4:
                sprite_sheet = np.zeros((sheet_height, sheet_width, 4), dtype=np.uint8)
            else:
                sprite_sheet = np.zeros((sheet_height, sheet_width, channels), dtype=np.uint8)
        else:
            # Solid background
            sprite_sheet = np.full(
                (sheet_height, sheet_width, channels),
                background_color[:channels],
                dtype=np.uint8
            )
        
        # Composite frames
        for idx, frame in enumerate(frames):
            row = idx // cols
            col = idx % cols
            
            y_start = row * frame_height
            y_end = y_start + frame_height
            x_start = col * frame_width
            x_end = x_start + frame_width
            
            # Paste frame
            if channels == 4 and frame.shape[2] == 4:
                # Alpha blending
                alpha = frame[:, :, 3:4] / 255.0
                sprite_sheet[y_start:y_end, x_start:x_end] = (
                    frame * alpha + sprite_sheet[y_start:y_end, x_start:x_end] * (1 - alpha)
                ).astype(np.uint8)
            else:
                sprite_sheet[y_start:y_end, x_start:x_end] = frame
        
        return sprite_sheet
    
    def _save_sprite_sheet(self, sprite_sheet: np.ndarray, output_path: Path) -> None:
        """
        Save sprite sheet to PNG file.
        
        Args:
            sprite_sheet: Sprite sheet as numpy array
            output_path: Output file path
        """
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert to PIL and save
        image = image_from_array(sprite_sheet)
        
        image.save(output_path, format='PNG')
    
    def _generate_metadata(
        self,
        frames: List[np.ndarray],
        layout: SpriteSheetLayout,
        animation_config: AnimationConfig,
        sprite_path: Path,
    ) -> Dict[str, Any]:
        """
        Generate sprite sheet metadata.
        
        Args:
            frames: List of frame arrays
            layout: Sprite sheet layout
            animation_config: Animation configuration
            sprite_path: Path to sprite sheet file
            
        Returns:
            Metadata dictionary
        """
        frame_height, frame_width, channels = frames[0].shape
        num_frames = len(frames)
        
        # Calculate grid dimensions
        if layout == SpriteSheetLayout.HORIZONTAL:
            cols = num_frames
            rows = 1
        elif layout == SpriteSheetLayout.VERTICAL:
            cols = 1
            rows = num_frames
        else:  # GRID
            cols = int(np.ceil(np.sqrt(num_frames)))
            rows = int(np.ceil(num_frames / cols))
        
        return {
            'version': '1.0',
            'sprite_sheet': str(sprite_path.name),
            'frame_count': num_frames,
            'frame_width': frame_width,
            'frame_height': frame_height,
            'layout': layout.value,
            'grid': {
                'columns': cols,
                'rows': rows,
            },
            'animation': {
                'duration': animation_config.duration,
                'fps': animation_config.fps,
                'loop': animation_config.loop,
                'motion_types': [mt.value for mt in animation_config.motion_types],
            },
            'frames': [
                {
                    'index': i,
                    'time': i / num_frames,
                    'position': {
                        'x': (i % cols) * frame_width,
                        'y': (i // cols) * frame_height,
                    }
                }
                for i in range(num_frames)
            ],
        }
    
    def _save_metadata(self, metadata: Dict[str, Any], output_path: Path) -> None:
        """
        Save metadata to JSON file.
        
        Args:
            metadata: Metadata dictionary
            output_path: Output file path
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)


# ============================================================================
# Convenience Functions
# ============================================================================

def generate_sprite_sheet_from_array(
    base_image: np.ndarray,
    animation_config: AnimationConfig,
    output_path: Path,
    background_color: Optional[Tuple[int, int, int, int]] = None,
) -> Tuple[Optional[Path], Optional[Path]]:
    """
    Convenience function to generate sprite sheet from numpy array.
    
    Args:
        base_image: Base image as numpy array
        animation_config: Animation configuration
        output_path: Output path for sprite sheet
        background_color: Background color (default: transparent)
        
    Returns:
        Tuple of (sprite_path, metadata_path) or (None, None) if failed
    """
    generator = SpriteSheetGenerator()
    return generator.generate_sprite_sheet(
        base_image,
        animation_config,
        output_path,
        background_color,
    )


def generate_sprite_sheet_from_file(
    image_path: Path,
    animation_config: AnimationConfig,
    output_path: Path,
    background_color: Optional[Tuple[int, int, int, int]] = None,
) -> Tuple[Optional[Path], Optional[Path]]:
    """
    Generate sprite sheet from image file.
    
    Args:
        image_path: Path to base image file
        animation_config: Animation configuration
        output_path: Output path for sprite sheet
        background_color: Background color (default: transparent)
        
    Returns:
        Tuple of (sprite_path, metadata_path) or (None, None) if failed
    """
    try:
        # Load image
        image = Image.open(image_path)
        
        # Convert to numpy array
        image_array = np.array(image)
        
        # Ensure RGBA
        if image_array.ndim == 2:
            # Grayscale to RGBA
            image_array = np.stack([image_array] * 3 + [np.full_like(image_array, 255)], axis=-1)
        elif image_array.shape[2] == 3:
            # RGB to RGBA
            alpha = np.full((image_array.shape[0], image_array.shape[1], 1), 255, dtype=np.uint8)
            image_array = np.concatenate([image_array, alpha], axis=-1)
        
        # Generate sprite sheet
        return generate_sprite_sheet_from_array(
            image_array,
            animation_config,
            output_path,
            background_color,
        )
        
    except Exception as e:
        logger.error(f"Failed to load image {image_path}: {e}")
        return None, None


def batch_generate_sprite_sheets(
    base_images: List[np.ndarray],
    animation_config: AnimationConfig,
    output_dir: Path,
    base_names: List[str],
    background_color: Optional[Tuple[int, int, int, int]] = None,
) -> List[Tuple[Path, Path]]:
    """
    Batch generate sprite sheets from multiple base images.
    
    Args:
        base_images: List of base image arrays
        animation_config: Animation configuration
        output_dir: Output directory
        base_names: List of base names for output files
        background_color: Background color (default: transparent)
        
    Returns:
        List of (sprite_path, metadata_path) tuples
    """
    generator = SpriteSheetGenerator()
    results = []
    
    for image, name in zip(base_images, base_names):
        motion_names = '_'.join([mt.value for mt in animation_config.motion_types])
        output_filename = f"{name}_sprite_{motion_names}.png"
        output_path = output_dir / output_filename
        
        sprite_path, metadata_path = generator.generate_sprite_sheet(
            image,
            animation_config,
            output_path,
            background_color,
        )
        
        if sprite_path and metadata_path:
            results.append((sprite_path, metadata_path))
        else:
            logger.warning(f"Failed to generate sprite sheet for {name}")
    
    logger.info(f"Batch generated {len(results)}/{len(base_images)} sprite sheets")
    return results


__all__ = [
    "SpriteSheetGenerator",
    "generate_animation_frames",
    "generate_sprite_sheet_from_array",
    "generate_sprite_sheet_from_file",
    "batch_generate_sprite_sheets",
]
