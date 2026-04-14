"""
UI Forge APNG Animator

Exports motion-sampled frames as animated PNG files for environments that want
single-file raster animation instead of sprite sheets or animated SVG.
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

from animation.sprite_sheet import generate_animation_frames
from models import AnimationConfig
from utils import image_from_array


logger = logging.getLogger(__name__)


class APNGAnimator:
    """Generate animated PNG files from a base image and animation config."""

    def generate_apng(
        self,
        base_image: np.ndarray,
        animation_config: AnimationConfig,
        output_path: Path,
    ) -> Optional[Path]:
        try:
            frames = generate_animation_frames(base_image, animation_config)
            if not frames:
                logger.error("No frames generated for APNG output")
                return None

            pil_frames = [self._to_pil_image(frame) for frame in frames]
            duration_ms = max(1, int(round(1000 / max(1, animation_config.fps))))

            output_path.parent.mkdir(parents=True, exist_ok=True)
            pil_frames[0].save(
                output_path,
                format="PNG",
                save_all=True,
                append_images=pil_frames[1:],
                duration=duration_ms,
                loop=0 if animation_config.loop else 1,
                disposal=2,
                optimize=False,
            )
            logger.info("Generated APNG: %s", output_path)
            return output_path
        except Exception as exc:
            logger.error("Failed to generate APNG: %s", exc)
            return None

    @staticmethod
    def _to_pil_image(frame: np.ndarray) -> Image.Image:
        return image_from_array(frame)


def generate_apng_from_array(
    base_image: np.ndarray,
    animation_config: AnimationConfig,
    output_path: Path,
) -> Optional[Path]:
    return APNGAnimator().generate_apng(base_image, animation_config, output_path)


__all__ = ["APNGAnimator", "generate_apng_from_array"]
