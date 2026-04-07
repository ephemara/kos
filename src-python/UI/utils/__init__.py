"""
UI Forge Utility Functions

Shared utility functions for color conversion, blend modes, anti-aliasing,
and file I/O operations.
"""

import numpy as np
from PIL import Image


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


__all__ = ["image_from_array"]
