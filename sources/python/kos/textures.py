"""
K_OS Texture Utilities
======================
Image processing, texture generation, and color science.
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import register

# Lazy imports
_PIL = None
_cv2 = None

def get_pil():
    global _PIL
    if _PIL is None:
        from PIL import Image
        _PIL = Image
    return _PIL

def get_cv2():
    global _cv2
    if _cv2 is None:
        import cv2
        _cv2 = cv2
    return _cv2

# --- TEXTURE OPERATIONS ---

@register("texture.load")
def load_texture(path: str) -> Dict[str, Any]:
    """Load an image and return as numpy array"""
    Image = get_pil()
    img = Image.open(path)
    arr = np.array(img)
    return {
        "data": arr.tolist(),
        "width": img.width,
        "height": img.height,
        "mode": img.mode,
        "channels": len(img.getbands())
    }

@register("texture.save")
def save_texture(data: List, path: str, width: int, height: int, mode: str = "RGB") -> str:
    """Save numpy array as image"""
    Image = get_pil()
    arr = np.array(data, dtype=np.uint8).reshape((height, width, -1))
    if arr.shape[2] == 1:
        arr = arr.squeeze()
    img = Image.fromarray(arr, mode=mode)
    img.save(path)
    return f"Saved: {path}"

@register("texture.generate_normal_map")
def generate_normal_map(heightmap: List, strength: float = 1.0) -> Dict[str, Any]:
    """Generate normal map from heightmap"""
    cv2 = get_cv2()
    height = np.array(heightmap, dtype=np.float32)
    
    # Sobel gradients
    dx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) * strength
    dy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) * strength
    
    # Compute normal
    normal = np.dstack((-dx, -dy, np.ones_like(height)))
    norm = np.linalg.norm(normal, axis=2, keepdims=True)
    normal = normal / (norm + 1e-8)
    
    # Convert to 0-255 range
    normal_map = ((normal + 1) * 127.5).astype(np.uint8)
    
    return {
        "data": normal_map.tolist(),
        "width": height.shape[1],
        "height": height.shape[0]
    }

@register("texture.generate_ao")
def generate_ambient_occlusion(heightmap: List, samples: int = 16, radius: float = 5.0) -> Dict[str, Any]:
    """Generate ambient occlusion from heightmap (screen-space approximation)"""
    height = np.array(heightmap, dtype=np.float32)
    h, w = height.shape
    
    ao = np.ones((h, w), dtype=np.float32)
    
    # Simple ray-based AO
    for _ in range(samples):
        angle = np.random.uniform(0, 2 * np.pi)
        distance = np.random.uniform(1, radius)
        dx = int(np.cos(angle) * distance)
        dy = int(np.sin(angle) * distance)
        
        # Sample neighboring height
        shifted = np.roll(np.roll(height, dx, axis=1), dy, axis=0)
        diff = shifted - height
        occlusion = np.clip(diff, 0, 1)
        ao -= occlusion / samples
    
    ao = np.clip(ao, 0, 1)
    ao_map = (ao * 255).astype(np.uint8)
    
    return {
        "data": ao_map.tolist(),
        "width": w,
        "height": h
    }

@register("texture.seamless_tile")
def make_seamless(data: List, width: int, height: int, blend_size: int = 32) -> Dict[str, Any]:
    """Make a texture seamlessly tileable"""
    cv2 = get_cv2()
    img = np.array(data, dtype=np.uint8).reshape((height, width, -1))
    
    # Create blend mask
    mask = np.ones((height, width), dtype=np.float32)
    
    # Feather edges
    for i in range(blend_size):
        alpha = i / blend_size
        mask[:, i] = np.minimum(mask[:, i], alpha)
        mask[:, -(i+1)] = np.minimum(mask[:, -(i+1)], alpha)
        mask[i, :] = np.minimum(mask[i, :], alpha)
        mask[-(i+1), :] = np.minimum(mask[-(i+1), :], alpha)
    
    # Blend with offset version
    offset_x = width // 2
    offset_y = height // 2
    
    rolled = np.roll(np.roll(img, offset_x, axis=1), offset_y, axis=0)
    
    mask_3d = mask[:, :, np.newaxis]
    result = (img * mask_3d + rolled * (1 - mask_3d)).astype(np.uint8)
    
    return {
        "data": result.tolist(),
        "width": width,
        "height": height
    }

@register("texture.color_transfer")
def color_transfer(source: List, target: List, width: int, height: int) -> Dict[str, Any]:
    """Transfer color palette from target to source image"""
    cv2 = get_cv2()
    
    src = np.array(source, dtype=np.float32).reshape((height, width, 3))
    tgt = np.array(target, dtype=np.float32).reshape((height, width, 3))
    
    # Convert to LAB
    src_lab = cv2.cvtColor(src / 255, cv2.COLOR_RGB2LAB)
    tgt_lab = cv2.cvtColor(tgt / 255, cv2.COLOR_RGB2LAB)
    
    # Match statistics per channel
    for i in range(3):
        src_mean, src_std = src_lab[:,:,i].mean(), src_lab[:,:,i].std()
        tgt_mean, tgt_std = tgt_lab[:,:,i].mean(), tgt_lab[:,:,i].std()
        
        src_lab[:,:,i] = (src_lab[:,:,i] - src_mean) * (tgt_std / (src_std + 1e-8)) + tgt_mean
    
    # Convert back
    result = cv2.cvtColor(src_lab, cv2.COLOR_LAB2RGB) * 255
    result = np.clip(result, 0, 255).astype(np.uint8)
    
    return {
        "data": result.tolist(),
        "width": width,
        "height": height
    }

@register("texture.upscale")
def upscale_texture(data: List, width: int, height: int, scale: int = 2) -> Dict[str, Any]:
    """Upscale texture using Lanczos (or AI upscaling if model available)"""
    Image = get_pil()
    
    arr = np.array(data, dtype=np.uint8).reshape((height, width, -1))
    img = Image.fromarray(arr)
    
    new_size = (width * scale, height * scale)
    upscaled = img.resize(new_size, Image.LANCZOS)
    
    return {
        "data": np.array(upscaled).tolist(),
        "width": new_size[0],
        "height": new_size[1]
    }
